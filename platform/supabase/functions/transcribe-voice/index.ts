import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0'
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 速率限制配置：每分钟 20 次请求（语音转写消耗大）
const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 20 };

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 速率限制检查
  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP, RATE_LIMIT_CONFIG);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt, corsHeaders);
  }

  try {
    const { audio, provider = 'browser_speech_api' } = await req.json()
    
    if (!audio) {
      throw new Error('No audio data provided')
    }

    // 如果使用浏览器 API，直接返回指示前端处理
    if (provider === 'browser_speech_api') {
      return new Response(
        JSON.stringify({ 
          text: '',
          useBrowserAPI: true,
          message: 'Please use browser Web Speech API for transcription'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Groq Whisper API (免费高速)
    if (provider === 'groq_whisper') {
      const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
      
      if (!GROQ_API_KEY) {
        throw new Error('Groq API Key not configured')
      }

      // 处理 base64 音频
      const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0))
      
      const formData = new FormData()
      const blob = new Blob([binaryAudio], { type: 'audio/webm' })
      formData.append('file', blob, 'audio.webm')
      formData.append('model', 'whisper-large-v3')
      // 添加多语言标点引导 prompt，让 Whisper 自动检测语言并输出标点
      formData.append('prompt', 'Hello, how are you? 你好，今天怎么样？Bonjour, comment ça va?')

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'Groq API 调用失败'
        
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.error?.message) {
            errorMessage = errorData.error.message
          }
        } catch {
          errorMessage = errorText
        }
        
        console.error('Groq API error:', errorText)
        throw new Error(errorMessage)
      }

      const result = await response.json()

      return new Response(
        JSON.stringify({ text: result.text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // OpenAI Whisper API (需要 API Key)
    if (provider === 'openai_whisper') {
      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
      
      if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API Key not configured')
      }

      // 处理 base64 音频
      const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0))
      
      const formData = new FormData()
      const blob = new Blob([binaryAudio], { type: 'audio/webm' })
      formData.append('file', blob, 'audio.webm')
      formData.append('model', 'whisper-1')

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'OpenAI API 调用失败'
        
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.error?.code === 'insufficient_quota') {
            errorMessage = 'API Key 额度不足，请充值后重试'
          } else if (errorData.error?.message) {
            errorMessage = errorData.error.message
          }
        } catch {
          errorMessage = errorText
        }
        
        console.error('OpenAI API error:', errorText)
        throw new Error(errorMessage)
      }

      const result = await response.json()

      return new Response(
        JSON.stringify({ text: result.text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error(`Unsupported provider: ${provider}`)

  } catch (error) {
    console.error('Transcription error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
