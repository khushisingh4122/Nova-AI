'use client'

import { Plus, Trash2, MessageSquare, Sparkles, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ChatSession {
  id: string
  title: string
  messages: any[]
  createdAt: Date
}

interface ChatSidebarProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  onSelectSession: (id: string) => void
  onNewChat: () => void
  onDeleteSession: (id: string) => void
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession
}: ChatSidebarProps) {
  return (
    <div className="w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-sidebar-border/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-primary-foreground/30 flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm tracking-tight text-foreground">Nova AI</h2>
          </div>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-4">
        <Button
          onClick={onNewChat}
          className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/95 hover:to-primary/85 text-white rounded-xl shadow-md shadow-primary/10 transition-all duration-300 transform hover:scale-[1.02] border-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Recent header */}
      <div className="px-4 py-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase opacity-60">
        Recent
      </div>

      {/* Chat History */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-1 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30 animate-bounce" />
              <p className="text-[10px] text-muted-foreground">No chats yet</p>
            </div>
          ) : (
            sessions.map((session) => {
              // Intelligently check if it has file uploads to show document icon
              const hasFiles = session.messages.some(m => 
                m.content.includes('[Content of file') || 
                m.content.includes('[Attached PDF')
              )

              return (
                <div
                  key={session.id}
                  className={`group relative p-2.5 rounded-xl cursor-pointer transition-all duration-200 flex items-center justify-between ${
                    currentSessionId === session.id
                      ? 'bg-sidebar-accent text-foreground font-medium shadow-sm'
                      : 'hover:bg-sidebar-accent/40 text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => onSelectSession(session.id)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {hasFiles ? (
                      <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                    )}
                    <span className="text-xs truncate">{session.title}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteSession(session.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive hover:text-destructive/80 transition-colors" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer Info */}
      <div className="p-4 border-t border-sidebar-border/30 text-[10px] text-muted-foreground opacity-60">
        <p className="font-semibold">Built with TanStack Start + Lovable AI</p>
      </div>
    </div>
  )
}
