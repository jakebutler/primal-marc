import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Send, Loader2, Mic, MicOff } from 'lucide-react'

interface MessageInputProps {
  onSendMessage: (content: string) => void
  onTypingChange: (isTyping: boolean) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onTypingChange,
  disabled = false,
  placeholder = "Type your message...",
  className
}) => {
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle typing indicator
  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    if (message.trim() && !isTyping) {
      setIsTyping(true)
      onTypingChange(true)
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false)
        onTypingChange(false)
      }
    }, 1000)

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [message, isTyping, onTypingChange])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [message])

  const handleSend = () => {
    const trimmedMessage = message.trim()
    if (!trimmedMessage || disabled) return

    onSendMessage(trimmedMessage)
    setMessage('')
    setIsTyping(false)
    onTypingChange(false)
    
    // Focus back to textarea
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
  }

  // Handle touch events for better mobile experience
  const handleTouchStart = (e: React.TouchEvent) => {
    // Prevent zoom on double tap for input
    e.preventDefault()
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  // Voice recording placeholder (would integrate with Web Speech API)
  const handleVoiceToggle = () => {
    setIsVoiceRecording(!isVoiceRecording)
    // TODO: Implement voice recording functionality
  }

  return (
    <div className={cn(
      "flex gap-2 bg-background",
      isMobile ? "p-3" : "p-4 border-t",
      className
    )}>
      <div className="flex-1 relative">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onTouchStart={handleTouchStart}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "resize-none transition-all duration-200",
            isMobile 
              ? "min-h-[48px] max-h-40 text-base pr-16" // Larger touch target on mobile
              : "min-h-[44px] max-h-32 pr-12"
          )}
          rows={1}
          style={{
            fontSize: isMobile ? '16px' : '14px', // Prevent zoom on iOS
          }}
        />
        
        {/* Character count indicator */}
        {message.length > 0 && (
          <div className={cn(
            "absolute text-xs text-muted-foreground",
            isMobile ? "bottom-3 right-14" : "bottom-2 right-12"
          )}>
            {message.length}
          </div>
        )}

        {/* Voice recording button (mobile only) */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={handleVoiceToggle}
            disabled={disabled}
          >
            {isVoiceRecording ? (
              <MicOff className="h-4 w-4 text-red-500" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      
      <Button
        onClick={handleSend}
        disabled={disabled || !message.trim()}
        size="icon"
        className={cn(
          "shrink-0 transition-all duration-200",
          isMobile ? "h-12 w-12" : "h-11 w-11" // Larger touch target on mobile
        )}
      >
        {disabled ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}