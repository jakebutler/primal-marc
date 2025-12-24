"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FlipCard } from "./flip-card";
import { Button } from "./button";
import { Eye, Code } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface MarkdownViewerProps {
  content: string;
  maxHeight?: string;
  editable?: boolean;
  onContentChange?: (content: string) => void;
  className?: string;
  isFlipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
  renderButton?: (props: { isFlipped: boolean; onFlip: (flipped: boolean) => void }) => React.ReactNode;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  maxHeight = "600px",
  editable = false,
  onContentChange,
  className,
  isFlipped: controlledIsFlipped,
  onFlipChange,
  renderButton,
}) => {
  const [internalIsFlipped, setInternalIsFlipped] = React.useState(false);
  const [localContent, setLocalContent] = React.useState(content);

  const isFlipped = controlledIsFlipped !== undefined ? controlledIsFlipped : internalIsFlipped;

  React.useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleContentChange = (newContent: string) => {
    setLocalContent(newContent);
    onContentChange?.(newContent);
  };

  const handleFlip = (flipped: boolean) => {
    if (controlledIsFlipped === undefined) {
      setInternalIsFlipped(flipped);
    }
    onFlipChange?.(flipped);
  };

  const rawMarkdownSide = (
    <div className="relative w-full" style={{ minHeight: maxHeight }}>
      {!renderButton && controlledIsFlipped === undefined && (
        <div className="absolute top-4 right-4 z-10">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleFlip(true)}
            className="bg-background/90 backdrop-blur-sm"
            aria-label="View preview"
          >
            <Eye className="mr-2 h-4 w-4" />
            View Preview
          </Button>
        </div>
      )}
      <div
        className="w-full overflow-y-auto p-4 border rounded-md bg-gray-50"
        style={{ maxHeight, minHeight: maxHeight }}
      >
        <div className="prose max-w-none whitespace-pre-wrap font-mono text-sm">
          {localContent || (
            <span className="text-muted-foreground italic">
              No content available
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const renderedPreviewSide = (
    <div className="relative w-full" style={{ minHeight: maxHeight }}>
      {!renderButton && controlledIsFlipped === undefined && (
        <div className="absolute top-4 right-4 z-10">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleFlip(false)}
            className="bg-background/90 backdrop-blur-sm"
            aria-label="View markdown"
          >
            <Code className="mr-2 h-4 w-4" />
            View/Edit Markdown
          </Button>
        </div>
      )}
      <div
        className="w-full overflow-y-auto p-4 border rounded-md bg-white"
        style={{ maxHeight, minHeight: maxHeight }}
        aria-live="polite"
      >
        {localContent ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {localContent}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-muted-foreground italic">
            No content available
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={cn("w-full", className)}>
      {renderButton && renderButton({ isFlipped, onFlip: handleFlip })}
      <FlipCard
        front={rawMarkdownSide}
        back={renderedPreviewSide}
        isFlipped={isFlipped}
        style={{ minHeight: maxHeight }}
      />
    </div>
  );
};

