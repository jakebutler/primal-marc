import { Router, Request, Response } from "express";
import { IdeaRefinerAgent } from "../agents/idea-refiner-agent";
import { getAgentConfig } from "../utils/api-keys";
import { flushOpikTraces } from "../utils/opik";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { blogPostId, userId, idea, blogType, voiceTone, selectedThesisOption } = req.body;

    if (!blogPostId || !userId || !idea || !blogType || !voiceTone) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields: blogPostId, userId, idea, blogType, voiceTone",
        },
      });
    }

    const config = await getAgentConfig(userId);
    const agent = new IdeaRefinerAgent(config);

    const result = await agent.generateThesisAndOutline(
      idea,
      blogType,
      voiceTone,
      selectedThesisOption
    );

    await flushOpikTraces();

    res.json({
      thesis: result.thesis,
      outline: result.outline,
      evidenceExpectations: result.evidenceExpectations,
      conclusionIntent: result.conclusionIntent,
    });
  } catch (error: any) {
    console.error("[Thesis Route] Error:", error);
    await flushOpikTraces();
    res.status(500).json({
      error: {
        code: "AGENT_ERROR",
        message: error.message || "Failed to generate thesis",
      },
    });
  }
});

export { router as thesisRoutes };

