import { OpikCallbackHandler } from "opik-langchain";

let opikHandler: OpikCallbackHandler | null = null;
let initializationAttempted = false;

/**
 * Get or create the Opik callback handler instance.
 * Returns null if Opik is not configured or unreachable.
 */
export function getOpikHandler(): OpikCallbackHandler | null {
  if (initializationAttempted) {
    return opikHandler;
  }
  
  initializationAttempted = true;
  
  const apiKey = process.env.OPIK_API_KEY;
  if (!apiKey) {
    return null;
  }
  
  const projectName = process.env.OPIK_PROJECT_NAME || "blog-generator-worker";
  
  try {
    opikHandler = new OpikCallbackHandler({
      apiKey: apiKey,
      projectName: projectName,
      tags: ["langchain", "worker"],
      metadata: {
        environment: process.env.NODE_ENV || "production",
      },
    });
    
    return opikHandler;
  } catch (error: any) {
    console.warn("[Opik] Failed to initialize:", error?.message || error);
    opikHandler = null;
    return null;
  }
}

/**
 * Flush all pending traces to Opik.
 */
export async function flushOpikTraces(): Promise<void> {
  if (!opikHandler) {
    return;
  }
  
  try {
    if (typeof opikHandler.flushAsync === 'function') {
      await opikHandler.flushAsync();
    } else if (typeof opikHandler.flush === 'function') {
      await opikHandler.flush();
    }
  } catch (error: any) {
    console.warn("[Opik] Failed to flush traces:", error?.message || error);
  }
}

