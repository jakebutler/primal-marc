"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";

interface ShapeHeroProps {
  className?: string;
  children?: React.ReactNode;
  shapeCount?: number;
  colors?: string[];
}

// Deterministic seed for consistent shape generation
const seededRandom = (seed: number) => {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
};

const generateShapes = (count: number, colors: string[]) => {
  const random = seededRandom(42); // Fixed seed for consistency
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    left: `${(i * 15 + random() * 10) % 100}%`,
    delay: i * 0.5,
    duration: 10 + random() * 5,
    size: 60 + random() * 80,
    color: colors[i % colors.length],
    rotation: random() * 360,
  }));
};

export function ShapeHero({ 
  className, 
  children,
  shapeCount = 6,
  colors = ["#e4572e", "#17bebb", "#ffc914"]
}: ShapeHeroProps) {
  const shapes = useMemo(() => generateShapes(shapeCount, colors), [shapeCount, colors]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Animated shapes */}
      {shapes.map((shape) => (
        <motion.div
          key={shape.id}
          className="absolute rounded-full opacity-20 blur-xl"
          style={{
            left: shape.left,
            width: shape.size,
            height: shape.size,
            backgroundColor: shape.color,
            top: "-10%",
          }}
          animate={{
            y: ["0vh", "110vh"],
            x: [0, Math.sin(shape.id) * 50],
            rotate: [shape.rotation, shape.rotation + 360],
            scale: [1, 1.2, 0.8, 1],
          }}
          transition={{
            duration: shape.duration,
            repeat: Infinity,
            ease: "linear",
            delay: shape.delay,
          }}
        />
      ))}
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

