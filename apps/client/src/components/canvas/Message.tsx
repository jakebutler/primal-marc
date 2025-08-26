import React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { User, Bot, Lightbulb, FileText, Image, CheckCircle } from 'lucide-react'
import type { SocketMessage } from '@/services/socket'

interface MessageProps {
  message: SocketMessage
  isStreaming?: boolean
  className?: string
}

const getAgentIcon = (agentType?: string) => {
  switch (agentType) {
    case 'ideation':
      return <Lightbulb className="h-4 w-4" />
    case 'refiner':
      return <FileText className="h-4 w-4" />
    case 'media':
      return <Image className="h-4 w-4" />
    case 'factchecker':
      return <CheckCircle className="h-4 w-4" />
    default:
      return <Bot className="h-4 w-4" />
  }
}

const getAgentName = (agentType?: string) => {
  switch (agentType) {
    case 'ideation':
      return 'Ideation Agent'
    case 'refiner':
      return 'Draft Refiner'
    case 'media':
      return 'Media Assistant'
    case 'factchecker':
      return 'Fact Checker'
    default:
      return 'AI Assistant'
  }
}

const getAgentColor = (agentType?: string) => {
  switch (agentType) {
    case 'ideation':
      return 'bg-yellow-500'
    case 'refiner':
      return 'bg-blue-500'
    case 'media':
      return 'bg-purple-500'
    case 'factchecker':
      return 'bg-green-500'
    default:
      return 'bg-gray-500'
  }
}

export const Message: React.FC<MessageProps> = ({ 
  message, 
  isStreaming = false, 
  className 
}) => {
  const isUser = message.role === 'user'
  const isAgent = message.role === 'agent'

  return (
    <div className={cn(
      "flex gap-3 p-4",
      isUser ? "flex-row-reverse" : "flex-row",
      className
    )}>
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        {isUser ? (
          <>
            <AvatarFallback className="bg-primary text-primary-foreground">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </>
        ) : (
          <>
            <AvatarFallback className={cn("text-white", getAgentColor(message.agentType))}>
              {getAgentIcon(message.agentType)}
            </AvatarFallback>
          </>
        )}
      </Avatar>

      {/* Message Content */}
      <div className={cn(
        "flex flex-col gap-1 max-w-[80%]",
        isUser ? "items-end" : "items-start"
      )}>
        {/* Agent Name Badge */}
        {isAgent && (
          <Badge variant="secondary" className="text-xs">
            {getAgentName(message.agentType)}
          </Badge>
        )}

        {/* Message Card */}
        <Card className={cn(
          "relative",
          isUser 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted"
        )}>
          <CardContent className="p-3">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {message.content}
            </div>
            
            {/* Streaming Indicator */}
            {isStreaming && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                <Spinner size="sm" />
                <span className="text-xs text-muted-foreground">
                  {getAgentName(message.agentType)} is typing...
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      </div>
    </div>
  )
}