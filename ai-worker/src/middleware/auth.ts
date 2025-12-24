import { Request, Response, NextFunction } from "express";

/**
 * Middleware to authenticate requests from Vercel
 * Expects Authorization: Bearer <WORKER_API_SECRET> header
 */
export function authenticateWorker(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const expectedSecret = process.env.WORKER_API_SECRET;

  if (!expectedSecret) {
    console.error("[Auth] WORKER_API_SECRET not configured");
    return res.status(500).json({
      error: {
        code: "CONFIGURATION_ERROR",
        message: "Worker authentication not configured",
      },
    });
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: {
        code: "AUTH_REQUIRED",
        message: "Authorization header required",
      },
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  if (token !== expectedSecret) {
    return res.status(403).json({
      error: {
        code: "AUTH_FAILED",
        message: "Invalid authentication token",
      },
    });
  }

  next();
}

