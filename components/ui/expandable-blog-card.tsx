"use client";

import * as React from "react";
import { Card, CardContent, CardHeader } from "./card";
import { Button } from "./button";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ExpandableBlogCardProps {
  id: string;
  title: string;
  blogType: string;
  preview: string;
  content: string;
  createdAt: string;
  wordCount?: number;
}

const BLOG_TYPE_LABELS: Record<string, string> = {
  academic: "Academic",
  argumentative: "Argumentative",
  lessons: "Lessons",
  metaphor: "Metaphor",
  systems: "Systems",
};

// Extract headline from markdown content
function extractHeadline(content: string): { headline: string; bodyContent: string } {
  const lines = content.split("\n");
  let headline = "";
  let bodyStartIndex = 0;

  // Find the first heading (# or ##)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const headingMatch = line.match(/^#{1,2}\s+(.+)$/);
    if (headingMatch) {
      headline = headingMatch[1];
      bodyStartIndex = i + 1;
      break;
    }
  }

  // Get content without the headline
  const bodyContent = lines.slice(bodyStartIndex).join("\n").trim();

  return { headline, bodyContent };
}

export function ExpandableBlogCard({
  id,
  title,
  blogType,
  preview,
  content,
  createdAt,
  wordCount,
}: ExpandableBlogCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Extract headline from content
  const { headline, bodyContent } = React.useMemo(
    () => extractHeadline(content),
    [content]
  );

  // Use extracted headline or fallback to title prop
  const displayTitle = headline || title || "Untitled Post";

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return "Today";
    } else if (diffInDays === 1) {
      return "1 day ago";
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
    } else {
      const months = Math.floor(diffInDays / 30);
      return `${months} ${months === 1 ? "month" : "months"} ago`;
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex-1 min-w-0">
          {/* Post type and date above headline */}
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-secondary/20 text-secondary">
              {BLOG_TYPE_LABELS[blogType] || blogType}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatDate(createdAt)}
            </span>
          </div>
          {/* Headline */}
          <h3 className="text-xl font-semibold text-foreground">
            {displayTitle}
          </h3>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!isExpanded ? (
          <>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
              {preview}
            </p>
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(true)}
                className="text-foreground hover:text-primary"
              >
                See More
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div
            className={cn(
              "space-y-4 transition-all duration-300 ease-in-out"
            )}
          >
            {/* Render body content without the headline */}
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {bodyContent}
              </ReactMarkdown>
            </div>
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className={cn(
                  "transition-all duration-200",
                  copied && "bg-green-50 border-green-200 text-green-700"
                )}
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Markdown
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="text-foreground hover:text-primary"
              >
                Collapse
                <ChevronUp className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

