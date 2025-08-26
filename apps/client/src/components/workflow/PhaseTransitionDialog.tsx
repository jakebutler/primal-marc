import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { PHASE_NAMES, PHASE_DESCRIPTIONS, PHASE_TYPES } from '@/services/workflow'

interface PhaseTransitionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPhase: string
  targetPhase: string
  onConfirm: () => void
  isLoading?: boolean
}

export const PhaseTransitionDialog: React.FC<PhaseTransitionDialogProps> = ({
  open,
  onOpenChange,
  currentPhase,
  targetPhase,
  onConfirm,
  isLoading = false
}) => {
  if (!targetPhase) return null

  const currentPhaseName = PHASE_NAMES[currentPhase as keyof typeof PHASE_NAMES]
  const targetPhaseName = PHASE_NAMES[targetPhase as keyof typeof PHASE_NAMES]
  const targetPhaseDescription = PHASE_DESCRIPTIONS[targetPhase as keyof typeof PHASE_DESCRIPTIONS]

  const isMovingForward = () => {
    const phases = Object.values(PHASE_TYPES)
    const currentIndex = phases.indexOf(currentPhase as any)
    const targetIndex = phases.indexOf(targetPhase as any)
    return targetIndex > currentIndex
  }

  const isSkipping = () => {
    const phases = Object.values(PHASE_TYPES)
    const currentIndex = phases.indexOf(currentPhase as any)
    const targetIndex = phases.indexOf(targetPhase as any)
    return Math.abs(targetIndex - currentIndex) > 1
  }

  const getTransitionType = () => {
    if (isSkipping()) {
      return isMovingForward() ? 'skip_forward' : 'skip_backward'
    }
    return isMovingForward() ? 'next' : 'previous'
  }

  const transitionType = getTransitionType()

  const getDialogContent = () => {
    switch (transitionType) {
      case 'skip_forward':
        return {
          title: 'Skip to Phase',
          description: `You're about to skip ahead to the ${targetPhaseName} phase. This will mark your current progress and move you forward in the workflow.`,
          warning: 'You can always return to previous phases later if needed.',
          confirmText: 'Skip to Phase',
          variant: 'default' as const
        }
      
      case 'skip_backward':
        return {
          title: 'Return to Previous Phase',
          description: `You're about to return to the ${targetPhaseName} phase. This will allow you to revisit and modify your previous work.`,
          warning: 'Your current phase progress will be preserved.',
          confirmText: 'Return to Phase',
          variant: 'outline' as const
        }
      
      case 'next':
        return {
          title: 'Move to Next Phase',
          description: `You're about to move to the ${targetPhaseName} phase. This will mark your current phase as completed.`,
          warning: 'Make sure you\'re satisfied with your current phase work before proceeding.',
          confirmText: 'Move to Next Phase',
          variant: 'default' as const
        }
      
      case 'previous':
        return {
          title: 'Return to Previous Phase',
          description: `You're about to return to the ${targetPhaseName} phase to make revisions.`,
          warning: 'You can move forward again once you\'re done with your revisions.',
          confirmText: 'Return to Phase',
          variant: 'outline' as const
        }
      
      default:
        return {
          title: 'Change Phase',
          description: `You're about to switch to the ${targetPhaseName} phase.`,
          warning: '',
          confirmText: 'Change Phase',
          variant: 'default' as const
        }
    }
  }

  const content = getDialogContent()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {(transitionType === 'skip_forward' || transitionType === 'skip_backward') && (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            {content.title}
          </DialogTitle>
          <DialogDescription className="text-left">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Phase Transition Visual */}
          <div className="flex items-center justify-center space-x-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <Badge variant="outline" className="mb-1">
                Current
              </Badge>
              <div className="text-sm font-medium">{currentPhaseName}</div>
            </div>
            
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            
            <div className="text-center">
              <Badge variant="default" className="mb-1">
                Target
              </Badge>
              <div className="text-sm font-medium">{targetPhaseName}</div>
            </div>
          </div>

          {/* Target Phase Description */}
          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
            <h4 className="text-sm font-medium text-primary mb-1">
              {targetPhaseName}
            </h4>
            <p className="text-sm text-muted-foreground">
              {targetPhaseDescription}
            </p>
          </div>

          {/* Warning Message */}
          {content.warning && (
            <div className="flex items-start space-x-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {content.warning}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={content.variant}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Changing...' : content.confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}