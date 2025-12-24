import express, { Request, Response, NextFunction } from "express";
import { voiceToneRoutes } from "./routes/voice-tone";
import { thesisRoutes } from "./routes/thesis";
import { researchRoutes } from "./routes/research";
import { draftRoutes } from "./routes/draft";
import { editorialRoutes } from "./routes/editorial";
import { authenticateWorker } from "./middleware/auth";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: "10mb" }));

// Health check endpoint (no auth required)
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// All other routes require authentication
app.use(authenticateWorker);

// Routes
app.use("/voice-tone", voiceToneRoutes);
app.use("/thesis", thesisRoutes);
app.use("/research", researchRoutes);
app.use("/draft", draftRoutes);
app.use("/editorial", editorialRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Worker error:", err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: err.message || "Internal server error",
    },
  });
});

app.listen(PORT, () => {
  console.log(`AI Worker service listening on port ${PORT}`);
});

