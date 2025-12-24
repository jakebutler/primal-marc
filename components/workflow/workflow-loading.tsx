"use client";

import { useState, useEffect } from "react";
import AILoading from "@/components/kokonutui/ai-loading";

interface WorkflowLoadingProps {
  messages: string[];
  title?: string;
  subtitle?: string;
  intervalMs?: number;
}

export function WorkflowLoading({
  messages,
  title,
  subtitle,
  intervalMs = 3000,
}: WorkflowLoadingProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [messages.length, intervalMs]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <AILoading
        title={title}
        subtitle={subtitle}
        loadingStates={messages.map((text, i) => ({
          text,
          loading: i === currentIndex,
        }))}
      />
    </div>
  );
}


