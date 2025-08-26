import React from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Bot, Lightbulb, FileText, Image, CheckCircle } from 'lucide-react'

interface TypingIndicatorProps {
  agentType?: string
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

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  agentType, 
  className 
}) => {
  return (
    <div className={cn("flex gap-3 p-4", className)}>
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn("text-white", getAgentColor(agentType))}>
          {getAgentIcon(agentType)}
        </AvatarFallback>
      </Avatar>

      {/* Typing Content */}
      <div className="flex flex-col gap-1">
        {/* Agent Name Badge */}
        <Badge variant="secondary" className="text-xs w-fit">
          {getAgentName(agentType)}
        </Badge>

        {/* Typing Animation */}
        <Card className="bg-muted">
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
              </div>
              <span className="text-xs text-muted-foreground ml-2">
                typing...
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}