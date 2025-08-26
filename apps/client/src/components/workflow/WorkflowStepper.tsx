import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle, 
  Circle, 
  Play,
  Lightbulb,
  Edit3,
  Image,
  CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkflowPhase } from '@/services/workflow'
import { PHASE_NAMES, PHASE_DESCRIPTIONS, PHASE_TYPES } from '@/services/workflow'

interface WorkflowStepperProps {
  phases: WorkflowPhase[]
  currentPhase: WorkflowPhase
  completedPhases: string[]
  onPhaseClick: (phaseType: string) => void
  disabled?: boolean
}

const PHASE_ICONS = {
  [PHASE_TYPES.IDEATION]: Lightbulb,
  [PHASE_TYPES.REFINEMENT]: Edit3,
  [PHASE_TYPES.MEDIA]: Image,
  [PHASE_TYPES.FACTCHECK]: CheckCircle2
}

const PHASE_ORDER = [
  PHASE_TYPES.IDEATION,
  PHASE_TYPES.REFINEMENT,
  PHASE_TYPES.MEDIA,
  PHASE_TYPES.FACTCHECK
]

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  phases,
  currentPhase,
  completedPhases,
  onPhaseClick,
  disabled = false
}) => {
  const getPhaseStatus = (phaseType: string) => {
    if (phaseType === currentPhase.type) return 'active'
    if (completedPhases.includes(phaseType)) return 'completed'
    return 'pending'
  }

  const getPhaseIndex = (phaseType: string) => {
    return PHASE_ORDER.indexOf(phaseType as any)
  }

  const isClickable = (phaseType: string) => {
    return !disabled && phaseType !== currentPhase.type
  }

  return (
    <div className="space-y-4">
      {PHASE_ORDER.map((phaseType, index) => {
        const phase = phases.find(p => p.type === phaseType)
        if (!phase) return null

        const status = getPhaseStatus(phaseType)
        const Icon = PHASE_ICONS[phaseType as keyof typeof PHASE_ICONS]
        const isLast = index === PHASE_ORDER.length - 1
        const clickable = isClickable(phaseType)

        return (
          <div key={phaseType} className="relative">
            {/* Connector Line */}
            {!isLast && (
              <div 
                className={cn(
                  "absolute left-6 top-12 w-0.5 h-8 -ml-px",
                  status === 'completed' ? 'bg-green-500' : 'bg-border'
                )}
              />
            )}

            {/* Step Content */}
            <div 
              className={cn(
                "flex items-start space-x-4 p-3 rounded-lg transition-colors",
                clickable && "cursor-pointer hover:bg-accent",
                status === 'active' && "bg-primary/5 border border-primary/20",
                !clickable && "cursor-default"
              )}
              onClick={() => clickable && onPhaseClick(phaseType)}
            >
              {/* Step Icon */}
              <div className="flex-shrink-0">
                <div 
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full border-2 transition-colors",
                    status === 'completed' && "bg-green-500 border-green-500 text-white",
                    status === 'active' && "bg-primary border-primary text-primary-foreground",
                    status === 'pending' && "bg-background border-border text-muted-foreground"
                  )}
                >
                  {status === 'completed' ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : status === 'active' ? (
                    <Play className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
              </div>

              {/* Step Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className={cn(
                    "font-medium",
                    status === 'active' && "text-primary",
                    status === 'completed' && "text-green-700 dark:text-green-400",
                    status === 'pending' && "text-muted-foreground"
                  )}>
                    {PHASE_NAMES[phaseType as keyof typeof PHASE_NAMES]}
                  </h3>
                  
                  <div className="flex items-center space-x-2">
                    {status === 'completed' && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Completed
                      </Badge>
                    )}
                    {status === 'active' && (
                      <Badge variant="default">
                        Active
                      </Badge>
                    )}
                    {status === 'pending' && (
                      <Badge variant="outline">
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground mb-2">
                  {PHASE_DESCRIPTIONS[phaseType as keyof typeof PHASE_DESCRIPTIONS]}
                </p>

                {/* Phase Metadata */}
                <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                  <span>Step {index + 1} of {PHASE_ORDER.length}</span>
                  {phase.completedAt && (
                    <span>
                      Completed {new Date(phase.completedAt).toLocaleDateString()}
                    </span>
                  )}
                  {status === 'active' && (
                    <span>
                      Started {new Date(phase.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Action Button for Current Phase */}
                {status === 'active' && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onPhaseClick(phaseType)
                      }}
                      disabled={disabled}
                    >
                      Continue Working
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}