import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface WorkflowNavigationProps {
  currentPhase: 'ideation' | 'refinement' | 'media' | 'factcheck'
  projectId: string
  onPhaseChange: (phase: string) => void
}

const phases = [
  { id: 'ideation', name: 'Ideation', description: 'Brainstorm and structure ideas' },
  { id: 'refinement', name: 'Refinement', description: 'Refine and improve content' },
  { id: 'media', name: 'Media & Visual', description: 'Add images and visual content' },
  { id: 'factcheck', name: 'Fact-checking & SEO', description: 'Verify facts and optimize for search' }
]

export function WorkflowNavigation({ currentPhase, projectId, onPhaseChange }: WorkflowNavigationProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold mb-4">Writing Workflow</h3>
        <div className="space-y-2">
          {phases.map((phase) => (
            <Button
              key={phase.id}
              variant={currentPhase === phase.id ? 'default' : 'outline'}
              className={`w-full justify-start ${currentPhase === phase.id ? 'active' : ''}`}
              onClick={() => onPhaseChange(phase.id)}
            >
              <div className="text-left">
                <div className="font-medium">{phase.name}</div>
                <div className="text-xs opacity-70">{phase.description}</div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}