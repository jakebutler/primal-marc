import React from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Eye,
  EyeOff,
  Save,
  Undo,
  Redo,
} from 'lucide-react'

interface MarkdownToolbarProps {
  onInsertText: (text: string, cursorOffset?: number) => void
  onTogglePreview: () => void
  onSave: () => void
  onUndo?: () => void
  onRedo?: () => void
  showPreview: boolean
  canUndo?: boolean
  canRedo?: boolean
  isSaving?: boolean
}

interface ToolbarButton {
  icon: React.ComponentType<{ className?: string }>
  label: string
  action: () => void
  shortcut?: string
  disabled?: boolean
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
  onInsertText,
  onTogglePreview,
  onSave,
  onUndo,
  onRedo,
  showPreview,
  canUndo = false,
  canRedo = false,
  isSaving = false,
}) => {
  const formatButtons: ToolbarButton[] = [
    {
      icon: Bold,
      label: 'Bold',
      action: () => onInsertText('**bold text**', -11),
      shortcut: 'Ctrl+B',
    },
    {
      icon: Italic,
      label: 'Italic',
      action: () => onInsertText('*italic text*', -12),
      shortcut: 'Ctrl+I',
    },
    {
      icon: Strikethrough,
      label: 'Strikethrough',
      action: () => onInsertText('~~strikethrough~~', -15),
    },
    {
      icon: Code,
      label: 'Inline Code',
      action: () => onInsertText('`code`', -5),
      shortcut: 'Ctrl+`',
    },
  ]

  const structureButtons: ToolbarButton[] = [
    {
      icon: Heading1,
      label: 'Heading 1',
      action: () => onInsertText('# Heading 1', 0),
    },
    {
      icon: Heading2,
      label: 'Heading 2',
      action: () => onInsertText('## Heading 2', 0),
    },
    {
      icon: Heading3,
      label: 'Heading 3',
      action: () => onInsertText('### Heading 3', 0),
    },
  ]

  const listButtons: ToolbarButton[] = [
    {
      icon: List,
      label: 'Bullet List',
      action: () => onInsertText('- List item', 0),
    },
    {
      icon: ListOrdered,
      label: 'Numbered List',
      action: () => onInsertText('1. List item', 0),
    },
    {
      icon: Quote,
      label: 'Quote',
      action: () => onInsertText('> Quote', 0),
    },
  ]

  const linkButton: ToolbarButton = {
    icon: Link,
    label: 'Link',
    action: () => onInsertText('[link text](url)', -4),
    shortcut: 'Ctrl+K',
  }

  const actionButtons: ToolbarButton[] = [
    {
      icon: Undo,
      label: 'Undo',
      action: () => onUndo?.(),
      shortcut: 'Ctrl+Z',
      disabled: !canUndo,
    },
    {
      icon: Redo,
      label: 'Redo',
      action: () => onRedo?.(),
      shortcut: 'Ctrl+Y',
      disabled: !canRedo,
    },
  ]

  const renderButton = (button: ToolbarButton) => (
    <Tooltip key={button.label}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={button.action}
          disabled={button.disabled}
          className="h-8 w-8 p-0"
        >
          <button.icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-center">
          <div>{button.label}</div>
          {button.shortcut && (
            <div className="text-xs text-muted-foreground">{button.shortcut}</div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Format buttons */}
        <div className="flex items-center gap-1">
          {formatButtons.map(renderButton)}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Structure buttons */}
        <div className="flex items-center gap-1">
          {structureButtons.map(renderButton)}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* List buttons */}
        <div className="flex items-center gap-1">
          {listButtons.map(renderButton)}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Link button */}
        <div className="flex items-center gap-1">
          {renderButton(linkButton)}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {actionButtons.map(renderButton)}
        </div>

        <div className="flex-1" />

        {/* Right side buttons */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onTogglePreview}
                className="h-8 w-8 p-0"
              >
                {showPreview ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSave}
                disabled={isSaving}
                className="h-8 w-8 p-0"
              >
                <Save className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <div>Save</div>
                <div className="text-xs text-muted-foreground">Ctrl+S</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}