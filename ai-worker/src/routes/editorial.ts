import { Router, Request, Response } from "express";
import { EditorialSEOAgent } from "../agents/editorial-seo-agent";
import { getAgentConfig } from "../utils/api-keys";
import { flushOpikTraces } from "../utils/opik";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId, draft, sources } = req.body;

    if (!userId || !draft) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields: userId, draft",
        },
      });
    }

    const config = await getAgentConfig(userId);
    const agent = new EditorialSEOAgent(config);

    const result = await agent.editAndOptimize(draft, sources || []);

    await flushOpikTraces();

    res.json({
      finalContent: result.finalContent,
      seoMetadata: result.seoMetadata,
      socialPosts: result.socialPosts,
    });
  } catch (error: any) {
    console.error("[Editorial Route] Error:", error);
    await flushOpikTraces();
    res.status(500).json({
      error: {
        code: "AGENT_ERROR",
        message: error.message || "Failed to edit and optimize",
      },
    });
  }
});

export { router as editorialRoutes };

