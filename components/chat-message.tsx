'use client'

import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatMessageProps {
  message: Message
  onCopy: () => void
  isCopied: boolean
}

export function ChatMessage({ message, onCopy, isCopied }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center">
          <span className="text-sm">🤖</span>
        </div>
      )}
      
      <div className="max-w-md lg:max-w-2xl">
        <div
          className={`rounded-lg p-4 ${
            isUser
              ? 'bg-primary/10 border border-primary/20 text-foreground dark:bg-white/10 dark:border-white/20'
              : 'bg-card border border-border text-foreground border-l-2 border-l-primary'
          }`}
        >
          <div className="prose dark:prose-invert max-w-none text-sm">
            {isUser ? (
              <p className="m-0 whitespace-pre-wrap">{message.content}</p>
            ) : (
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  code: ({ inline, children }: any) => (
                    inline ? (
                      <code className="bg-background/50 px-2 py-1 rounded text-xs font-mono">
                        {children}
                      </code>
                    ) : (
                      <code className="text-xs font-mono block">
                        {children}
                      </code>
                    )
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-background/50 p-3 rounded-lg overflow-x-auto mb-2">
                      {children}
                    </pre>
                  ),
                  a: ({ href, children }) => (
                    <a href={href} className="text-primary hover:underline">
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary pl-3 italic mb-2">
                      {children}
                    </blockquote>
                  ),
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        </div>

        {!isUser && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {isCopied ? (
              <>
                <Check className="w-3 h-3 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </>
            )}
          </Button>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center">
          <span className="text-sm">👤</span>
        </div>
      )}
    </div>
  )
}
