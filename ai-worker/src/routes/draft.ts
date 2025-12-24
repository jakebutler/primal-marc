import { Router, Request, Response } from "express";
import { BlogWriterAgent } from "../agents/blog-writer-agent";
import { getAgentConfig } from "../utils/api-keys";
import { countWords } from "../utils/word-count";
import { flushOpikTraces } from "../utils/opik";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      userId,
      blogType,
      thesis,
      outline,
      sources,
      voiceTone,
      styleGuidelines,
    } = req.body;

    if (
      !userId ||
      !blogType ||
      !thesis ||
      !outline ||
      !sources ||
      !voiceTone
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Missing required fields: userId, blogType, thesis, outline, sources, voiceTone",
        },
      });
    }

    const config = await getAgentConfig(userId);
    const agent = new BlogWriterAgent(config);

    const content = await agent.writeDraft(
      blogType,
      thesis,
      outline,
      sources,
      voiceTone,
      styleGuidelines
    );

    const wordCount = countWords(content);

    await flushOpikTraces();

    res.json({
      content,
      wordCount,
    });
  } catch (error: any) {
    console.error("[Draft Route] Error:", error);
    await flushOpikTraces();
    res.status(500).json({
      error: {
        code: "AGENT_ERROR",
        message: error.message || "Failed to write draft",
      },
    });
  }
});

export { router as draftRoutes };

