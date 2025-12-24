import { Router, Request, Response } from "express";
import { getVoiceToneOptionsForBlogType } from "../data/voice-tone-presets";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { blogType } = req.body;

    if (!blogType) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required field: blogType",
        },
      });
    }

    const options = getVoiceToneOptionsForBlogType(blogType);

    if (options.length === 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `No voice/tone options available for blog type: ${blogType}`,
        },
      });
    }

    res.json({ options });
  } catch (error: any) {
    console.error("[VoiceTone Route] Error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: error.message || "Failed to get voice/tone options",
      },
    });
  }
});

export { router as voiceToneRoutes };

