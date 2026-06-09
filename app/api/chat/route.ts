import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { message, isVoiceCall } = await request.json()

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get API key from environment
    const apiKey = (process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY)?.trim()

    // Check if we should call Groq
    const isGroq = apiKey?.startsWith('gsk_')

    // If key is not set, is 'free_mock_mode', or is a rate-limited AQ. key, run local Mock AI fallback!
    if (!apiKey || apiKey === 'free_mock_mode' || apiKey.startsWith('AQ.')) {
      const userQuery = message.toLowerCase()
      let reply = ""

      if (isVoiceCall) {
        reply = "I'm running in free demo mode right now, but I'm ready to chat! What's on your mind today?"
      } else if (userQuery.includes('capital') && userQuery.includes('france')) {
        reply = "The capital of France is **Paris**! 🗼 It is one of the world's leading business and cultural centers, and its influence in politics, education, entertainment, media, science, and the arts all contribute to its status as one of the world's major global cities."
      } else if (userQuery.includes('hello') || userQuery.includes('hi')) {
        reply = "Hello there! 👋 I am your AI Chat Assistant, currently running in **Free Demo Mode** because a valid Gemini or Groq API Key is not configured in `.env.local`.\n\nAsk me any question, and I will generate a simulated response, or paste a real `AIzaSy...` (Gemini) or `gsk_...` (Groq) key to unlock live AI answers!"
      } else if (userQuery.includes('file') || userQuery.includes('content of file')) {
        reply = "I see you uploaded a file! 📄 I have scanned and parsed the text content successfully. Let me know if you would like me to extract key terms, summarize its paragraphs, or query specific facts!"
      } else {
        reply = `You asked: "${message}"\n\nI am currently running in **Free Demo Mode** because your API key is either rate-limited or not set.\n\n*(Tip: You can use **either** a Gemini key from Google AI Studio (starting with \`AIzaSy...\`) or a Groq key (starting with \`gsk_...\`) in your \`.env.local\` file to unlock full live responses!)*`
      }

      return NextResponse.json({ message: reply })
    }

    if (isGroq) {
      // Call Groq API (OpenAI compatible)
      const messages = []
      
      if (isVoiceCall) {
        messages.push({
          role: 'system',
          content: 'You are in a live, hands-free voice call. Keep your response extremely brief, friendly, and conversational (1-2 short sentences max). Do not use markdown, formatting, lists, or code blocks. Speak naturally!'
        })
      }
      
      messages.push({
        role: 'user',
        content: message
      })

      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages,
            temperature: 0.6,
            max_tokens: isVoiceCall ? 150 : 2048
          })
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Groq API error:', errorData)
        return NextResponse.json(
          { 
            error: 'Failed to get response from Groq',
            message: errorData.error?.message || 'Failed to get response from Groq',
            details: errorData
          },
          { status: response.status }
        )
      }

      const data = await response.json()
      const text = data.choices?.[0]?.message?.content || 'No response received from Groq'
      return NextResponse.json({ message: text })
    }

    // Call Gemini API
    const finalPrompt = isVoiceCall 
      ? `[Voice Conversation System Prompt: You are in a live, hands-free voice call. Answer the following message in 1-2 brief, friendly, conversational sentences max. Do not use markdown, lists, or bullet points. Speak naturally.]\n\nUser message: ${message}`
      : message

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: finalPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.6,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: isVoiceCall ? 150 : 2048,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_NONE',
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_NONE',
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_NONE',
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_NONE',
            },
          ],
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Gemini API error:', errorData)
      return NextResponse.json(
        { 
          error: 'Failed to get response from Gemini',
          message: errorData.error?.message || 'Failed to get response from Gemini',
          details: errorData
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Extract the text from the response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received'

    return NextResponse.json({ message: text })
  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
