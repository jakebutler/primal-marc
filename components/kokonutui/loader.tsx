"use client";

import { motion } from "framer-motion";

interface LoaderProps {
  title?: string;
  description?: string;
}

export default function Loader({ title, description }: LoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="relative">
        <motion.div
          className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full"
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>
      {title && (
        <motion.h2
          className="text-xl font-semibold"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {title}
        </motion.h2>
      )}
      {description && (
        <motion.p
          className="text-sm text-muted-foreground text-center max-w-md"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {description}
        </motion.p>
      )}
    </div>
  );
}


