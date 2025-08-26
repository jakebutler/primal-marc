import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

interface CanvasChatProps {
  projectId: string
  agentType: 'ideation' | 'refiner' | 'media' | 'factcheck'
  onContentUpdate: (content: string) => void
}

interface Message {
  id: string
  content: string
  role: 'user' | 'agent'
  agentType?: string
  timestamp: Date
}

export function CanvasChat({ projectId, agentType, onContentUpdate }: CanvasChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const sendMessage = async () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      role: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    if (!isOnline) {
      // Handle offline mode
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        content: 'Message queued for when you\'re back online',
        role: 'agent',
        agentType,
        timestamp: new Date()
      }])
      setIsLoading(false)
      return
    }

    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const agentResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: `I've received your message about "${inputValue}". Let me help you with that.`,
        role: 'agent',
        agentType,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, agentResponse])
      onContentUpdate(agentResponse.content)
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        content: 'Failed to send message. Please try again.',
        role: 'agent',
        agentType,
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-1 p-4">
        {!isOnline && (
          <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded">
            You are offline. Messages will be queued.
          </div>
        )}

        <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              data-testid={message.role === 'user' ? 'user-message' : 'agent-message'}
              className={`p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-100 ml-8'
                  : 'bg-gray-100 mr-8'
              }`}
            >
              <div className="text-sm text-gray-600 mb-1">
                {message.role === 'agent' && message.agentType && (
                  <span className="font-medium">
                    {message.agentType.charAt(0).toUpperCase() + message.agentType.slice(1)} Agent
                  </span>
                )}
              </div>
              <div>{message.content}</div>
            </div>
          ))}
          
          {isLoading && (
            <div className="bg-gray-100 mr-8 p-3 rounded-lg">
              <div className="animate-pulse">Agent is typing...</div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            data-testid="message-input"
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <Button
            data-testid="send-button"
            onClick={sendMessage}
            disabled={isLoading || !inputValue.trim()}
          >
            Send
          </Button>
          {messages.some(m => m.content.includes('Failed to send')) && (
            <Button
              variant="outline"
              onClick={() => {
                // Retry last failed message
                const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
                if (lastUserMessage) {
                  setInputValue(lastUserMessage.content)
                }
              }}
            >
              Retry
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}