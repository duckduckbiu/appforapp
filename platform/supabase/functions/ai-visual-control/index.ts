import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VisualControlRequest {
  screenshot: string; // base64 encoded image
  taskDescription: string;
  screenshotSize?: {
    width: number;
    height: number;
  };
  previousActions?: Array<{
    type: string;
    description: string;
    success: boolean;
  }>;
  context?: {
    currentUrl?: string;
    pageTitle?: string;
  };
}

interface AIAction {
  type: 'click' | 'type' | 'scroll' | 'wait' | 'done' | 'failed';
  thinking: string;
  data?: {
    x?: number;
    y?: number;
    text?: string;
    direction?: 'up' | 'down';
    amount?: number;
    duration?: number;
    reason?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { screenshot, taskDescription, screenshotSize, previousActions, context }: VisualControlRequest = await req.json();

    if (!screenshot || !taskDescription) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: screenshot and taskDescription' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sizeInfo = screenshotSize 
      ? `\n\n截图尺寸: ${screenshotSize.width} x ${screenshotSize.height} 像素` 
      : '';

    const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN');
    if (!GITHUB_TOKEN) {
      console.error('GITHUB_TOKEN is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build previous actions context
    const previousActionsText = previousActions?.length
      ? `\n\n之前执行的操作:\n${previousActions.map((a, i) => 
          `${i + 1}. ${a.type}: ${a.description} (${a.success ? '成功' : '失败'})`
        ).join('\n')}`
      : '';

    const contextText = context
      ? `\n当前页面: ${context.pageTitle || '未知'} (${context.currentUrl || '未知URL'})`
      : '';

    const systemPrompt = `你是一个视觉AI助手,专门分析屏幕截图并生成操作指令来完成用户任务。

当前应用: 这是一个聊天/消息应用,界面布局如下:
- 左侧: 联系人/对话列表
- 中间: 聊天内容区域,底部有消息输入框和发送按钮
- 顶部: 搜索栏(用于搜索联系人,不是发送消息的地方!)
- 消息输入框通常在聊天区域的最底部,有"输入消息..."之类的占位符

关键区分:
- 顶部的搜索框: 用于搜索联系人/用户,不要在这里输入聊天消息!
- 底部的消息输入框: 用于输入聊天消息,这才是发送消息的地方

操作类型:
- click: 点击某个位置,需要提供 x, y 坐标(相对于截图尺寸的像素值)
- type: 在当前已聚焦的输入框输入文字,需要提供 text (必须先点击输入框聚焦!)
- scroll: 滚动页面,需要提供 direction (up/down) 和 amount (像素数)
- wait: 等待页面加载,需要提供 duration (毫秒)
- done: 任务已完成
- failed: 任务无法完成,需要提供 reason

重要规则:
1. 坐标基于截图的实际像素尺寸,从左上角(0,0)开始
2. 点击位置应该在目标元素的中心
3. 每次只返回一个操作
4. 要输入文字前,必须先点击目标输入框!
5. 发送聊天消息的流程: 先点击底部消息输入框 → 输入文字 → 点击发送按钮
6. thinking 字段要详细说明你观察到了什么、为什么做这个决定
7. 如果之前的操作失败,尝试不同的策略
8. 如果多次尝试后仍无法完成,返回 failed

返回格式(严格JSON,不要包含markdown代码块):
{
  "type": "click",
  "thinking": "我观察到页面底部有消息输入框,位于约(500, 900)位置,点击它准备输入消息",
  "data": {
    "x": 500,
    "y": 900
  }
}`;

    const userPrompt = `任务: ${taskDescription}${sizeInfo}${contextText}${previousActionsText}

请分析这张截图,决定下一步操作。记住:发送消息要用底部的消息输入框,不是顶部的搜索框!`;

    console.log('Calling GitHub Models (Phi-4-multimodal-instruct) for visual analysis...');
    console.log('Task:', taskDescription);

    const response = await fetch('https://models.github.ai/inference/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'Phi-4-multimodal-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: userPrompt },
              { 
                type: 'image_url', 
                image_url: { 
                  url: screenshot.startsWith('data:') ? screenshot : `data:image/png;base64,${screenshot}` 
                } 
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI service error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required, please add credits' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      console.error('Empty AI response');
      return new Response(
        JSON.stringify({ error: 'Empty AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI response:', content);

    // Parse the JSON response
    let action: AIAction;
    try {
      // Try to extract JSON from the response (might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, content];
      const jsonStr = jsonMatch[1] || content;
      action = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Return a default failed action
      action = {
        type: 'failed',
        thinking: `AI返回了无法解析的响应: ${content.substring(0, 200)}`,
        data: { reason: 'Invalid AI response format' }
      };
    }

    return new Response(
      JSON.stringify({ action }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-visual-control:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
