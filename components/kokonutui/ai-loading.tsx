"use client";

import { motion, AnimatePresence } from "framer-motion";

interface LoadingState {
  text: string;
  loading: boolean;
}

interface AILoadingProps {
  title?: string;
  subtitle?: string;
  loadingStates: LoadingState[];
}

export default function AILoading({
  title,
  subtitle,
  loadingStates,
}: AILoadingProps) {
  const activeState = loadingStates.find((state) => state.loading) || loadingStates[0];

  return (
    <div className="flex flex-col items-center justify-center space-y-6 max-w-md">
      {/* Animated loader */}
      <div className="relative w-20 h-20">
        <motion.div
          className="absolute inset-0 border-4 border-primary/20 rounded-full"
          animate={{ rotate: 360 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        <motion.div
          className="absolute inset-2 border-4 border-secondary/40 rounded-full"
          animate={{ rotate: -360 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-2 h-2 bg-accent rounded-full"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
      </div>

      {/* Title */}
      {title && (
        <motion.h2
          className="text-2xl font-semibold text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {title}
        </motion.h2>
      )}

      {/* Subtitle */}
      {subtitle && (
        <motion.p
          className="text-sm text-muted-foreground text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {subtitle}
        </motion.p>
      )}

      {/* Loading states text */}
      <AnimatePresence mode="wait">
        {activeState && (
          <motion.p
            key={activeState.text}
            className="text-base text-center font-medium"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeState.text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

