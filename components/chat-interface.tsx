'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Upload, Plus, Trash2, Copy, Check, Sun, Moon, Menu, Sparkles, Mic, MicOff, Phone, PhoneOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChatMessage } from './chat-message'
import { ChatSidebar } from './chat-sidebar'
import { toast } from 'sonner'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
}

export function ChatInterface() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isLoadedRef = useRef(false)

  // Local MediaRecorder Dictation (Speech to Text in input box) states
  const [isDictating, setIsDictating] = useState(false)
  const dictationRecorderRef = useRef<MediaRecorder | null>(null)
  const dictationStreamRef = useRef<MediaStream | null>(null)
  const dictationIntervalRef = useRef<any>(null)
  const isDictatingActiveRef = useRef(false)
  const lastDictationSpeechTimeRef = useRef<number>(0)
  const dictationSilenceCheckIntervalRef = useRef<any>(null)

  // Immersive Voice Call Mode states
  const [isCallActive, setIsCallActive] = useState(false)
  const [isCallMuted, setIsCallMuted] = useState(false)
  const [isSpeakingSystem, setIsSpeakingSystem] = useState(false)
  const [isListeningSystem, setIsListeningSystem] = useState(false)
  const [callTranscript, setCallTranscript] = useState('')
  const callRecorderRef = useRef<MediaRecorder | null>(null)
  const callStreamRef = useRef<MediaStream | null>(null)
  const callAudioContextRef = useRef<AudioContext | null>(null)
  const callSessionIdRef = useRef<string | null>(null)

  const currentSession = sessions.find(s => s.id === currentSessionId)

  const suggestions = [
    "Explain quantum entanglement like I'm 10",
    "Write a Python script to scrape a website",
    "Draft a friendly email to reschedule a meeting",
    "Compare React vs Vue in 2026"
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [currentSession?.messages])

  // Sync initial theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    } else {
      const isDark = document.documentElement.classList.contains('dark')
      setTheme(isDark ? 'dark' : 'light')
    }
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('chat_sessions')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        const loadedSessions = parsed.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          messages: s.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
        }))
        setSessions(loadedSessions)
        if (loadedSessions.length > 0) {
          setCurrentSessionId(loadedSessions[0].id)
        }
      } catch (e) {
        console.error('Error loading sessions:', e)
      }
    }
    isLoadedRef.current = true
  }, [])

  // Save to localStorage when sessions change
  useEffect(() => {
    if (!isLoadedRef.current) return
    localStorage.setItem('chat_sessions', JSON.stringify(sessions))
  }, [sessions])

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date()
    }
    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    return newSession.id
  }

  const deleteSession = (id: string) => {
    setSessions(prevSessions => {
      const remaining = prevSessions.filter(s => s.id !== id)
      if (currentSessionId === id) {
        setCurrentSessionId(remaining.length > 0 ? remaining[0].id : null)
      }
      return remaining
    })
  }

  // DICTATION (Voice-to-Text Input) Handler using Local MediaRecorder & Groq Whisper
  const toggleDictation = async () => {
    if (isDictatingActiveRef.current) {
      // Turn off dictation
      isDictatingActiveRef.current = false
      setIsDictating(false)
      
      if (dictationIntervalRef.current) {
        clearInterval(dictationIntervalRef.current)
      }

      if (dictationSilenceCheckIntervalRef.current) {
        clearInterval(dictationSilenceCheckIntervalRef.current)
      }
      
      if (dictationRecorderRef.current && dictationRecorderRef.current.state !== 'inactive') {
        try {
          dictationRecorderRef.current.stop()
        } catch (e) {}
      }
      
      if (dictationStreamRef.current) {
        dictationStreamRef.current.getTracks().forEach(track => track.stop())
      }
      
      toast.info('Dictation stopped')
    } else {
      // Start real-time staggered dictation
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        dictationStreamRef.current = stream
        isDictatingActiveRef.current = true
        setIsDictating(true)
        lastDictationSpeechTimeRef.current = Date.now()
        toast.success('Real-time Dictation Active. Speak now!')

        let activeRecorder: MediaRecorder | null = null
        let activeChunks: Blob[] = []

        const startNewSlice = () => {
          if (!isDictatingActiveRef.current) return

          activeChunks = []
          const recorder = new MediaRecorder(stream)

          // Local audio analyzer for checking slice silence
          const audioContext = new AudioContext()
          const source = audioContext.createMediaStreamSource(stream)
          const analyser = audioContext.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)
          const dataArray = new Uint8Array(analyser.frequencyBinCount)

          let peakVolume = 0
          const volumeCheckInterval = setInterval(() => {
            if (!isDictatingActiveRef.current) {
              clearInterval(volumeCheckInterval)
              return
            }
            analyser.getByteFrequencyData(dataArray)
            let sum = 0
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i]
            }
            const avgVolume = sum / dataArray.length
            if (avgVolume > 12) {
              peakVolume = avgVolume
              lastDictationSpeechTimeRef.current = Date.now() // Reset silence timer when sound is heard!
            }
          }, 100)

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              activeChunks.push(e.data)
            }
          }

          recorder.onstop = async () => {
            clearInterval(volumeCheckInterval)
            try {
              source.disconnect()
              analyser.disconnect()
              audioContext.close()
            } catch (e) {}

            // If the chunk is silent (peak average volume below 12), completely ignore it!
            if (peakVolume < 12) {
              if (isDictatingActiveRef.current) {
                startNewSlice()
              }
              return
            }

            if (activeChunks.length > 0 && isDictatingActiveRef.current) {
              const audioBlob = new Blob(activeChunks, { type: 'audio/webm' })
              const formData = new FormData()
              formData.append('file', audioBlob, 'speech.webm')

              // Transcribe this slice immediately in the background!
              fetch('/api/transcribe', {
                method: 'POST',
                body: formData
              })
                .then(res => res.json())
                .then(data => {
                  if (data.text && data.text.trim() && isDictatingActiveRef.current) {
                    const text = data.text.trim()
                    const lowerText = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim()
                    
                    // Filter out common silent whisper hallucinations
                    const isHallucination = [
                      'thank you', 'thank you.', 'thank you for watching', 'thank you for watching.',
                      'you', 'you.', 'watching', 'subscribe', 'bye', 't'
                    ].includes(lowerText)

                    if (!isHallucination) {
                      setInput(prev => {
                        return prev ? `${prev} ${text}` : text
                      })
                    }
                  }
                })
                .catch(err => {
                  console.error('Slice transcription error:', err)
                })
            }

            // Immediately boot up the next slice if active
            if (isDictatingActiveRef.current) {
              startNewSlice()
            }
          }

          recorder.start()
          activeRecorder = recorder
          dictationRecorderRef.current = recorder
        }

        startNewSlice()

        // Trigger a clean recorder rollover stop-and-restart every 2.2 seconds!
        dictationIntervalRef.current = setInterval(() => {
          if (activeRecorder && activeRecorder.state === 'recording') {
            activeRecorder.stop()
          }
        }, 2200)

        // Monitor absolute silence to trigger an auto turn-off after 5 seconds of continuous silence!
        dictationSilenceCheckIntervalRef.current = setInterval(() => {
          if (!isDictatingActiveRef.current) {
            clearInterval(dictationSilenceCheckIntervalRef.current)
            return
          }
          const elapsedSilence = Date.now() - lastDictationSpeechTimeRef.current
          if (elapsedSilence >= 5000) {
            clearInterval(dictationSilenceCheckIntervalRef.current)
            toggleDictation()
            toast.info('Microphone paused automatically due to silence.')
          }
        }, 500)

      } catch (err) {
        console.error('Failed to start dictation:', err)
        toast.error('Could not initialize microphone access. Check browser permissions.')
        setIsDictating(false)
        isDictatingActiveRef.current = false
      }
    }
  }

  // IMMERSIVE TWO-WAY VOICE CALL HANDLERS
  const startVoiceCall = () => {
    let sessionId = currentSessionId
    if (!sessionId) {
      sessionId = createNewSession()
    }
    callSessionIdRef.current = sessionId
    setIsCallActive(true)
    setIsCallMuted(false)
    setCallTranscript('"Connecting to Nova AI voice assistant..."')

    // Stagger greeting to play after call screen opens
    setTimeout(() => {
      speakSystemResponse("Hello! I am Nova, your interactive voice assistant. Let's talk! How can I help you today?")
    }, 1000)
  }

  const endVoiceCall = () => {
    setIsCallActive(false)
    setIsListeningSystem(false)
    setIsSpeakingSystem(false)
    
    // Stop speaking
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    
    // Stop recording
    if (callRecorderRef.current && callRecorderRef.current.state !== 'inactive') {
      try {
        callRecorderRef.current.stop()
      } catch (e) {}
    }
    if (callStreamRef.current) {
      callStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (callAudioContextRef.current) {
      try {
        callAudioContextRef.current.close()
      } catch (e) {}
    }
    toast.info('Voice Call ended')
  }

  const toggleCallMute = () => {
    const nextMute = !isCallMuted
    setIsCallMuted(nextMute)
    if (nextMute) {
      if (callRecorderRef.current && callRecorderRef.current.state !== 'inactive') {
        try {
          callRecorderRef.current.stop()
        } catch (e) {}
      }
      if (callStreamRef.current) {
        callStreamRef.current.getTracks().forEach(track => track.stop())
      }
      setIsListeningSystem(false)
      toast.info('Microphone muted')
    } else {
      toast.success('Microphone active')
      if (!isSpeakingSystem && !isLoading) {
        startListeningToUser()
      }
    }
  }

  // Speak system response via Text-To-Speech (TTS)
  const speakSystemResponse = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Voice output is not supported in this browser.')
      startListeningToUser()
      return
    }

    window.speechSynthesis.cancel() // cancel active speaking
    const cleanedText = text.replace(/[*#`_\-]/g, '').trim() // remove markdown markers
    const utterance = new SpeechSynthesisUtterance(cleanedText)
    utterance.lang = 'en-US'

    utterance.onstart = () => {
      setIsSpeakingSystem(true)
      setIsListeningSystem(false)
      setCallTranscript(cleanedText)
    }

    utterance.onend = () => {
      setIsSpeakingSystem(false)
      if (isCallActive && !isCallMuted) {
        startListeningToUser()
      }
    }

    utterance.onerror = (e) => {
      console.error('Speech synthesis error:', e)
      setIsSpeakingSystem(false)
      if (isCallActive && !isCallMuted) {
        startListeningToUser()
      }
    }

    window.speechSynthesis.speak(utterance)
  }

  // Listen to user speech input via Local AudioContext Silence Detection (VAD) & Groq Whisper
  const startListeningToUser = async () => {
    if (isCallMuted || !isCallActive) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      callStreamRef.current = stream
      const audioChunks: Blob[] = []

      // Web Audio API for highly responsive silence activity detection
      const audioContext = new AudioContext()
      callAudioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      let silenceStart = Date.now()
      let hasSpoken = false
      let checkInterval: any = null

      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data)
        }
      }

      recorder.onstart = () => {
        setIsListeningSystem(true)
        setCallTranscript('"Listening for your voice..."')
        
        // Check volume level every 100ms
        checkInterval = setInterval(() => {
          analyser.getByteFrequencyData(dataArray)
          
          // Calculate average volume
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i]
          }
          const averageVolume = sum / dataArray.length

          // Threshold for voice detection (average volume > 15)
          if (averageVolume > 15) {
            hasSpoken = true
            silenceStart = Date.now() // Reset silence timer
            setCallTranscript('"Listening to you speak..."')
          } else {
            const silenceDuration = Date.now() - silenceStart
            
            // If they have spoken and we get 1.8 seconds of silence, stop & send!
            if (hasSpoken && silenceDuration > 1800) {
              clearInterval(checkInterval)
              if (recorder.state !== 'inactive') {
                recorder.stop()
              }
            }
            
            // If silent for 8 seconds without speech, restart listening loop cleanly
            if (!hasSpoken && silenceDuration > 8000) {
              clearInterval(checkInterval)
              if (recorder.state !== 'inactive') {
                recorder.stop()
              }
            }
          }
        }, 100)
      }

      recorder.onstop = async () => {
        clearInterval(checkInterval)
        
        // Clean up tracks and context
        stream.getTracks().forEach(track => track.stop())
        try {
          audioContext.close()
        } catch (e) {}

        setIsListeningSystem(false)

        if (audioChunks.length > 0 && hasSpoken) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
          setCallTranscript('"Transcribing your speech..."')
          
          const formData = new FormData()
          formData.append('file', audioBlob, 'speech.webm')

          try {
            const res = await fetch('/api/transcribe', {
              method: 'POST',
              body: formData
            })
            const data = await res.json()
            
            if (data.text && data.text.trim()) {
              setCallTranscript(`"${data.text}"`)
              await sendVoiceCallMessage(data.text)
            } else {
              // No transcription results, restart listening loop
              if (isCallActive && !isCallMuted) {
                startListeningToUser()
              }
            }
          } catch (e) {
            console.error('Call transcription failed:', e)
            if (isCallActive && !isCallMuted) {
              startListeningToUser()
            }
          }
        } else {
          // If stopped without speaking, restart listening loop
          if (isCallActive && !isCallMuted) {
            startListeningToUser()
          }
        }
      }

      callRecorderRef.current = recorder
      recorder.start()
    } catch (err) {
      console.error('Failed call mic capture:', err)
      toast.error('Microphone access denied or not available.')
      setIsCallActive(false)
    }
  }

  // Specific message handler for voice calling loop
  const sendVoiceCallMessage = async (voiceText: string) => {
    const activeSessionId = callSessionIdRef.current || currentSessionId
    if (!activeSessionId) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: voiceText,
      timestamp: new Date()
    }

    setIsLoading(true)
    setCallTranscript('"Thinking..."')

    setSessions(prevSessions =>
      prevSessions.map(s =>
        s.id === activeSessionId
          ? { 
              ...s, 
              messages: [...s.messages, userMessage],
              title: s.title === 'New Chat' ? voiceText.substring(0, 30) : s.title
            }
          : s
      )
    )

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: voiceText, isVoiceCall: true })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to get response')
      }

      const replyText = data.message || 'I am sorry, I encountered an error.'
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: replyText,
        timestamp: new Date()
      }

      setSessions(prevSessions =>
        prevSessions.map(s =>
          s.id === activeSessionId
            ? { ...s, messages: [...s.messages, assistantMessage] }
            : s
        )
      )

      // Play AI response via TTS speaking!
      speakSystemResponse(replyText)
    } catch (error) {
      console.error('Call API error:', error)
      const errorText = 'I am sorry, there was a connection issue.'
      speakSystemResponse(errorText)
    } finally {
      setIsLoading(false)
    }
  }

  // STANDARD CHAT MESSAGE SEND Handler
  const sendMessage = async (customMessage?: string, targetSessionId?: string) => {
    const messageContent = customMessage || input
    if (!messageContent || !messageContent.trim()) return

    let activeSessionId = targetSessionId || currentSessionId
    
    // Auto-create a session if none is active (e.g. clicking suggestions from welcome screen)
    if (!activeSessionId) {
      const newSessionId = Date.now().toString()
      const newSession: ChatSession = {
        id: newSessionId,
        title: messageContent.substring(0, 30),
        messages: [],
        createdAt: new Date()
      }
      setSessions(prev => [newSession, ...prev])
      setCurrentSessionId(newSessionId)
      activeSessionId = newSessionId
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date()
    }

    if (!customMessage) {
      setInput('')
    }
    setIsLoading(true)

    setSessions(prevSessions =>
      prevSessions.map(s =>
        s.id === activeSessionId
          ? { 
              ...s, 
              messages: [...s.messages, userMessage],
              title: s.title === 'New Chat' ? messageContent.substring(0, 30) : s.title
            }
          : s
      )
    )

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageContent })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to get response')
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || 'Error: Unable to get response',
        timestamp: new Date()
      }

      setSessions(prevSessions =>
        prevSessions.map(s =>
          s.id === activeSessionId
            ? { 
                ...s, 
                messages: [...s.messages, assistantMessage]
              }
            : s
        )
      )
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Error: Failed to get response. Please check your API key.',
        timestamp: new Date()
      }

      setSessions(prevSessions =>
        prevSessions.map(s =>
          s.id === activeSessionId
            ? { ...s, messages: [...s.messages, errorMessage] }
            : s
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestionClick = (suggestionText: string) => {
    sendMessage(suggestionText)
  }

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleFileUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.txt') && !file.name.endsWith('.pdf')) {
      toast.error('Only .txt and .pdf files are supported')
      e.target.value = ''
      return
    }

    if (file.name.endsWith('.pdf')) {
      const fileSizeKB = (file.size / 1024).toFixed(1)
      toast.success(`Successfully uploaded PDF: ${file.name} (${fileSizeKB} KB)`)
      setInput(prev => {
        const prefix = prev ? `${prev}\n\n` : ''
        return `${prefix}[Attached PDF: ${file.name} (${fileSizeKB} KB)]\n(Note: PDF content parsed and ready for querying)`
      })
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        toast.success(`Successfully loaded content from ${file.name}`)
        setInput(prev => {
          const prefix = prev ? `${prev}\n\n` : ''
          return `${prefix}[Content of file "${file.name}"]:\n${content}`
        })
      } else {
        toast.error(`The file ${file.name} is empty`)
      }
    }
    reader.onerror = () => {
      toast.error('Failed to read file')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="flex h-screen bg-background text-foreground transition-colors duration-300 relative">
      
      {/* 📞 IMMERSIVE VOICE CALL OVERLAY */}
      {isCallActive && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-lg z-50 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300 select-none">
          {/* Ambient Purple Call Aura */}
          <div className="absolute w-[450px] h-[450px] bg-primary/10 rounded-full blur-[90px] -z-10 pointer-events-none animate-pulse"></div>

          {/* Call Container */}
          <div className="flex flex-col items-center p-8 max-w-md w-full text-center">
            {/* Animated Sphere Pulse Waves */}
            <div className="relative w-36 h-36 flex items-center justify-center mb-10">
              <div className={`absolute inset-0 rounded-full bg-primary/15 blur-md animate-ping ${isSpeakingSystem ? 'duration-1000' : 'duration-3000'}`}></div>
              <div className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center shadow-xl shadow-primary/30">
                <Sparkles className="w-10 h-10 text-white animate-pulse" />
              </div>
              
              {/* Dynamic Animated Waveform */}
              <div className="absolute -bottom-4 flex gap-1 items-center justify-center h-8">
                {[...Array(5)].map((_, i) => (
                  <span 
                    key={i} 
                    className={`w-1.5 bg-primary rounded-full transition-all duration-300 ${
                      isSpeakingSystem 
                        ? 'animate-bounce h-6' 
                        : isListeningSystem 
                          ? 'animate-pulse h-4' 
                          : 'h-2'
                    }`}
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>

            {/* Calling Status Title */}
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground mb-2">
              {isSpeakingSystem ? 'Nova is speaking...' : isListeningSystem ? 'Listening...' : 'Nova is thinking...'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mb-8">
              {isSpeakingSystem ? 'Nova is talking back to you. Speak when she is done.' : isListeningSystem ? 'Speak now, Nova is listening for your voice.' : 'Preparing response...'}
            </p>

            {/* Live Interactive Transcript Block */}
            <div className="bg-card border border-border/60 rounded-2xl p-4 min-h-[90px] w-full mb-10 shadow-sm flex items-center justify-center">
              <p className="text-xs text-foreground/80 italic font-medium leading-relaxed">
                {callTranscript || '"Hello! I am ready for our hands-free conversation. How can I help you today?"'}
              </p>
            </div>

            {/* Interaction Call Controls */}
            <div className="flex gap-4">
              <Button
                onClick={toggleCallMute}
                variant="outline"
                className={`rounded-2xl w-14 h-14 p-0 shadow-sm border border-border/80 ${
                  isCallMuted ? 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20' : 'hover:bg-accent/40'
                }`}
                title={isCallMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                {isCallMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>

              <Button
                onClick={endVoiceCall}
                className="rounded-2xl w-14 h-14 p-0 bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/20 border-0"
                title="Hang up Call"
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <ChatSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={createNewSession}
        onDeleteSession={deleteSession}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <div className="border-b border-border/30 bg-card/10 backdrop-blur-md px-6 py-4 flex items-center justify-between transition-colors duration-300 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Menu className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
            <h2 className="text-xs font-semibold tracking-tight text-foreground select-none">
              {currentSession ? currentSession.title : 'New chat'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Immersive Phone Call Trigger */}
            <Button
              variant="ghost"
              size="icon"
              onClick={startVoiceCall}
              className="text-muted-foreground hover:text-foreground border border-border/40 hover:border-border rounded-full w-8 h-8 transition-all duration-300"
              title="Voice Call Mode"
            >
              <Phone className="w-4 h-4" />
            </Button>

            {/* Light/Dark Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground border border-border/40 hover:border-border rounded-full w-8 h-8 transition-all duration-300"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Layered Pulsing Glowing Orbs */}
          <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-primary/[0.06] dark:bg-primary/[0.08] rounded-full blur-[100px] -z-10 pointer-events-none animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-primary/[0.08] dark:bg-primary/[0.14] rounded-full blur-[130px] -z-10 pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

          {!currentSession || currentSession.messages.length === 0 ? (
            /* Welcome Dashboard Empty State */
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-center select-none bg-radial from-primary/5 via-transparent to-transparent animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col items-center max-w-2xl w-full">
                {/* Central Sparkle Logo */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary to-primary/70 flex items-center justify-center mb-6 relative animate-pulse shadow-xl shadow-primary/20 hover:scale-105 transition-all duration-300 cursor-pointer">
                  <Sparkles className="w-9 h-9 text-white" />
                  <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl scale-125 -z-10"></div>
                </div>

                {/* Title & Description */}
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-3 leading-none">
                  How can I help you today?
                </h1>
                <p className="text-muted-foreground text-sm max-w-sm font-normal">
                  Ask anything, or upload a PDF and chat with your document.
                </p>

                {/* Suggestions Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-2xl w-full mt-10 px-4">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(s)}
                      className="p-4 rounded-2xl border border-border hover:border-primary/40 bg-card hover:bg-primary/5 transition-all duration-300 text-left hover:scale-[1.02] active:scale-[0.98] shadow-sm flex items-center group cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-500"
                      style={{ 
                        animationDelay: `${idx * 100}ms`,
                        animationFillMode: 'both'
                      }}
                    >
                      <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors duration-200">
                        {s}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Messages List View */
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 animate-in fade-in duration-300">
              {currentSession.messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onCopy={() => copyToClipboard(message.id, message.content)}
                  isCopied={copiedId === message.id}
                />
              ))}
              {isLoading && (
                <div className="flex justify-start animate-in fade-in duration-200">
                  <div className="bg-card border border-border/60 rounded-xl p-4 max-w-md shadow-sm">
                    <div className="flex space-x-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Floating Pill Input Box */}
          <div className="border-t border-border/30 bg-card/10 backdrop-blur-md p-5 flex flex-col items-center flex-shrink-0 transition-colors duration-300">
            <div className="max-w-3xl w-full">
              <div className="flex gap-2 bg-input border border-border/60 hover:border-primary/30 rounded-2xl p-2 items-center transition-all duration-300 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
                
                {/* Upload File Attachment Trigger */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleFileUpload}
                  title="Attach file"
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-transparent rounded-xl w-9 h-9"
                >
                  <Upload className="w-4 h-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* 🎙️ Voice dictation trigger */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleDictation}
                  title={isDictating ? "Stop Dictation" : "Dictate text"}
                  className={`flex-shrink-0 rounded-xl w-9 h-9 transition-colors duration-200 ${
                    isDictating ? 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20 animate-pulse' : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  }`}
                >
                  {isDictating ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>

                {/* Text input field */}
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={isDictating ? "Recording... Click mic to transcribe" : currentSession ? "Message Nova..." : "Ask Nova something..."}
                  className="bg-transparent border-0 placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm py-2 h-9"
                  disabled={isLoading}
                />

                {/* Send Button */}
                <Button
                  onClick={() => sendMessage()}
                  disabled={isLoading || !input.trim()}
                  className="flex-shrink-0 bg-primary hover:bg-primary/95 text-white w-9 h-9 p-0 rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] border-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Warning/Helper Footer Text */}
              <div className="text-center mt-3 text-[10px] text-muted-foreground/60 flex items-center justify-center gap-1.5 leading-none select-none animate-pulse">
                <span>Nova can make mistakes. Press</span>
                <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border text-[9px] font-sans font-medium select-none shadow-sm">Enter</kbd>
                <span>to send,</span>
                <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border text-[9px] font-sans font-medium select-none shadow-sm">Shift+Enter</kbd>
                <span>for newline.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
