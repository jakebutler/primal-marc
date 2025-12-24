import { Router, Request, Response } from "express";
import { ResearchAgent } from "../agents/research-agent";
import { getAgentConfig } from "../utils/api-keys";
import { flushOpikTraces } from "../utils/opik";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      thesis,
      outline,
      evidenceExpectations,
      perplexityApiKey,
      exaApiKey,
    } = req.body;

    if (!thesis || !outline || !evidenceExpectations) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields: thesis, outline, evidenceExpectations",
        },
      });
    }

    // Get API keys from request or environment
    const perplexityKey =
      perplexityApiKey || process.env.PERPLEXITY_API_KEY;
    const exaKey = exaApiKey || process.env.EXA_API_KEY;

    if (!perplexityKey && !exaKey) {
      return res.status(400).json({
        error: {
          code: "CONFIGURATION_ERROR",
          message:
            "Research API keys are not configured. Please set PERPLEXITY_API_KEY or EXA_API_KEY.",
        },
      });
    }

    // For research, we need an LLM provider for structuring results
    // We'll use the userId if provided, otherwise fall back to env
    const userId = req.body.userId;
    let config;
    try {
      config = userId ? await getAgentConfig(userId) : {
        provider: (process.env.DEFAULT_LLM_PROVIDER as "openai" | "anthropic") || "openai",
        apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || "",
      };
    } catch {
      // Fallback to environment variables
      config = {
        provider: (process.env.DEFAULT_LLM_PROVIDER as "openai" | "anthropic") || "openai",
        apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || "",
      };
    }

    const agent = new ResearchAgent(config, perplexityKey, exaKey);

    const result = await agent.research(thesis, outline, evidenceExpectations);

    await flushOpikTraces();

    res.json({
      sources: result.sources || [],
      sectionMapping: result.sectionMapping || {},
      suggestedRevisions: result.suggestedRevisions || {},
    });
  } catch (error: any) {
    console.error("[Research Route] Error:", error);
    await flushOpikTraces();
    res.status(500).json({
      error: {
        code: "AGENT_ERROR",
        message: error.message || "Failed to perform research",
      },
    });
  }
});

export { router as researchRoutes };

