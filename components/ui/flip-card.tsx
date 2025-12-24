"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  isFlipped: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const FlipCard = React.forwardRef<HTMLDivElement, FlipCardProps>(
  ({ front, back, isFlipped, className, style }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flip-card-container relative w-full", className)}
        style={style}
      >
        <div
          className={cn(
            "flip-card-inner relative w-full h-full",
            isFlipped && "flipped"
          )}
        >
          <div className="flip-card-face">{front}</div>
          <div className="flip-card-face flip-card-back">{back}</div>
        </div>
      </div>
    );
  }
);

FlipCard.displayName = "FlipCard";

