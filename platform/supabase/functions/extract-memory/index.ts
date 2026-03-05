import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      avatarId, 
      conversationId, 
      messageIds, // 要分析的消息 ID 列表
      mode = 'auto' // 'auto' 或 'manual'
    } = await req.json();

    if (!avatarId) {
      throw new Error('缺少 avatarId 参数');
    }

    console.log('Memory Extraction - Starting:', { avatarId, conversationId, mode });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 验证 AI 分身存在
    const { data: avatar, error: avatarError } = await supabase
      .from('ai_avatars')
      .select('id, name, display_name')
      .eq('id', avatarId)
      .single();

    if (avatarError || !avatar) {
      throw new Error('AI 分身不存在');
    }

    // 获取要分析的消息
    let messagesToAnalyze: any[] = [];

    if (messageIds && messageIds.length > 0) {
      // 手动指定的消息
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          sender_id,
          created_at,
          conversation_id,
          profiles:sender_id(unique_username, display_name)
        `)
        .in('id', messageIds);

      if (msgError) {
        throw new Error('获取消息失败');
      }
      messagesToAnalyze = messages || [];
    } else if (conversationId) {
      // 分析整个会话的最近消息
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          sender_id,
          created_at,
          conversation_id,
          profiles:sender_id(unique_username, display_name)
        `)
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(30);

      if (msgError) {
        throw new Error('获取会话消息失败');
      }
      messagesToAnalyze = messages || [];
    } else {
      throw new Error('必须提供 messageIds 或 conversationId');
    }

    if (messagesToAnalyze.length === 0) {
      return new Response(
        JSON.stringify({ success: true, memories: [], message: 'No messages to analyze' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing ${messagesToAnalyze.length} messages`);

    // 构建对话历史
    const conversationText = messagesToAnalyze
      .reverse()
      .map((msg: any) => {
        const senderName = msg.profiles?.display_name || msg.profiles?.unique_username || 'Unknown';
        return `${senderName}: ${msg.content}`;
      })
      .join('\n');

    // 调用 AI 提取记忆
    const AI_API_KEY = Deno.env.get('AI_API_KEY');
    if (!AI_API_KEY) {
      throw new Error('AI_API_KEY 未配置');
    }

    const extractionPrompt = `你是一个记忆提取系统。请从以下对话中提取重要的记忆信息，这些记忆将帮助 AI 分身 "${avatar.display_name || avatar.name}" 在未来的对话中更好地理解对话对象。

对话内容：
${conversationText}

请提取以下类型的记忆（如果存在）：
1. **fact（事实）**：客观的事实信息，如职业、年龄、居住地、教育背景等
2. **preference（偏好）**：喜好、厌恶、习惯等
3. **relationship（关系）**：与对话对象的关系状态、亲密度变化等
4. **event（事件）**：重要的事件、经历、故事等
5. **emotion（情感）**：表达的情绪、情感状态等

对每条记忆，请评估其重要性（1-10分）：
- 1-3分：琐碎信息
- 4-6分：一般重要
- 7-8分：比较重要
- 9-10分：非常重要

请以 JSON 数组格式返回，每个记忆包含：
- memory_type: 记忆类型（fact/preference/relationship/event/emotion）
- subject: 记忆主题（简短的关键词或短语）
- content: 记忆内容描述（1-2句话）
- importance: 重要性（1-10）
- emotional_tag: 情感标签（positive/negative/neutral）

示例：
[
  {
    "memory_type": "fact",
    "subject": "职业",
    "content": "对方是一名软件工程师，在一家科技公司工作",
    "importance": 7,
    "emotional_tag": "neutral"
  },
  {
    "memory_type": "preference",
    "subject": "喜好",
    "content": "对方喜欢喝咖啡，尤其是拿铁",
    "importance": 5,
    "emotional_tag": "positive"
  }
]

**重要**：
- 只提取明确提到的信息，不要推测或臆造
- 如果对话没有值得记录的信息，返回空数组 []
- 确保返回的是有效的 JSON 格式`;

    console.log('Calling AI for memory extraction...');

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: extractionPrompt }
        ],
        temperature: 0.3, // 较低的温度以确保准确性
        max_tokens: 1000
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI 提取失败:', aiResponse.status, errorText);
      throw new Error('AI 记忆提取失败');
    }

    const aiData = await aiResponse.json();
    const extractedContent = aiData.choices?.[0]?.message?.content;

    if (!extractedContent) {
      throw new Error('AI 未返回有效内容');
    }

    console.log('AI extracted content:', extractedContent.substring(0, 200) + '...');

    // 解析 AI 返回的 JSON
    let memories: any[] = [];
    try {
      // 尝试从返回内容中提取 JSON（可能包含在 markdown 代码块中）
      const jsonMatch = extractedContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        memories = JSON.parse(jsonMatch[0]);
      } else {
        memories = JSON.parse(extractedContent);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('Raw content:', extractedContent);
      throw new Error('AI 返回的内容格式无效');
    }

    if (!Array.isArray(memories) || memories.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          memories: [], 
          message: 'No significant memories extracted' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracted ${memories.length} memories, inserting into database...`);

    // 插入记忆到数据库
    const memoriesToInsert = memories.map((mem: any) => ({
      avatar_id: avatarId,
      memory_type: mem.memory_type,
      subject: mem.subject,
      content: mem.content,
      importance: mem.importance,
      emotional_tag: mem.emotional_tag,
      source_conversation_id: conversationId || messagesToAnalyze[0]?.conversation_id,
      source_message_id: messagesToAnalyze[0]?.id, // 使用第一条消息作为来源
      metadata: {
        extraction_mode: mode,
        analyzed_message_count: messagesToAnalyze.length
      }
    }));

    const { data: insertedMemories, error: insertError } = await supabase
      .from('ai_avatar_memory')
      .insert(memoriesToInsert)
      .select();

    if (insertError) {
      console.error('Failed to insert memories:', insertError);
      throw new Error('记忆存储失败');
    }

    console.log(`Successfully inserted ${insertedMemories.length} memories`);

    return new Response(
      JSON.stringify({ 
        success: true,
        memories: insertedMemories,
        message: `Successfully extracted and stored ${insertedMemories.length} memories`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Memory Extraction Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || '未知错误',
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
