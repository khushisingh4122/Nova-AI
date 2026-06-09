import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      )
    }

    // Get Groq API key from environment
    const apiKey = (process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY)?.trim()

    if (!apiKey || apiKey === 'free_mock_mode' || apiKey.startsWith('AQ.')) {
      // Fallback Mock transcription for demo mode
      return NextResponse.json({ 
        text: "Tell me more about quantum physics." 
      })
    }

    // Prepare Multipart Form Data for Groq Whisper API
    const groqFormData = new FormData()
    groqFormData.append('file', file)
    groqFormData.append('model', 'whisper-large-v3')
    groqFormData.append('language', 'en')

    const response = await fetch(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: groqFormData
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Groq Whisper API error:', errorData)
      return NextResponse.json(
        { 
          error: 'Failed to transcribe audio from Groq',
          message: errorData.error?.message || 'Groq Whisper error'
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({ text: data.text || '' })
  } catch (error) {
    console.error('Transcribe API route error:', error)
    return NextResponse.json(
      { 
        error: 'Internal transcription error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
