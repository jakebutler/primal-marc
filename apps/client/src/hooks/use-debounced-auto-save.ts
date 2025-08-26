import { useCallback, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'

interface AutoSaveOptions {
  delay?: number
  onSave: (content: string, title: string) => Promise<void>
  onError?: (error: Error) => void
}

export function useDebouncedAutoSave({ 
  delay = 2000, 
  onSave, 
  onError 
}: AutoSaveOptions) {
  const { toast } = useToast()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const isSavingRef = useRef(false)

  const scheduleAutoSave = useCallback((content: string, title: string) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Don't schedule if already saving
    if (isSavingRef.current) {
      return
    }

    // Schedule new auto-save
    timeoutRef.current = setTimeout(async () => {
      try {
        isSavingRef.current = true
        await onSave(content, title)
        
        toast({
          title: "Auto-saved",
          description: "Your changes have been saved automatically.",
          duration: 2000,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        toast({
          title: "Auto-save failed",
          description: errorMessage,
          variant: "destructive",
          duration: 4000,
        })
        
        if (onError) {
          onError(error instanceof Error ? error : new Error(errorMessage))
        }
      } finally {
        isSavingRef.current = false
      }
    }, delay)
  }, [delay, onSave, onError, toast])

  const cancelAutoSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
  }, [])

  const forceSave = useCallback(async (content: string, title: string) => {
    cancelAutoSave()
    
    if (isSavingRef.current) {
      return
    }

    try {
      isSavingRef.current = true
      await onSave(content, title)
      
      toast({
        title: "Saved",
        description: "Your changes have been saved.",
        duration: 2000,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      toast({
        title: "Save failed",
        description: errorMessage,
        variant: "destructive",
        duration: 4000,
      })
      
      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage))
      }
    } finally {
      isSavingRef.current = false
    }
  }, [cancelAutoSave, onSave, onError, toast])

  return {
    scheduleAutoSave,
    cancelAutoSave,
    forceSave,
    isSaving: isSavingRef.current,
  }
}