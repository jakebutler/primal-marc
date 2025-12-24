import { OpikCallbackHandler } from "opik-langchain";

let opikHandler: OpikCallbackHandler | null = null;
let initializationAttempted = false;

/**
 * Get or create the Opik callback handler instance.
 * Returns null if Opik is not configured or unreachable.
 * Designed to work with VPN environments.
 */
export function getOpikHandler(): OpikCallbackHandler | null {
  // Only attempt initialization once to avoid repeated failures
  if (initializationAttempted) {
    return opikHandler;
  }
  
  initializationAttempted = true;
  
  const apiKey = process.env.OPIK_API_KEY;
  if (!apiKey) {
    // Silently skip if no API key - Opik is optional
    return null;
  }
  
  // Get project name from environment variable, fallback to default
  const projectName = process.env.OPIK_PROJECT_NAME || "blog-generator";
  
  try {
    // Type assertion to work around TypeScript type mismatch
    // The runtime API still accepts these parameters
    opikHandler = new OpikCallbackHandler({
      apiKey: apiKey,
      projectName: projectName,
      metadata: {
        environment: process.env.NODE_ENV || "development",
      },
    } as any);
    
    return opikHandler;
  } catch (error: any) {
    console.warn("[Opik] Failed to initialize:", error?.message || error);
    opikHandler = null; // Ensure it's set to null on failure
    return null;
  }
}

/**
 * Flush all pending traces to Opik.
 * Call this at the end of API route handlers.
 */
export async function flushOpikTraces(): Promise<void> {
  if (!opikHandler) {
    return; // No handler, nothing to flush
  }
  
  try {
    // Use type assertion to access methods that may exist at runtime
    // but aren't in the TypeScript types
    const handler = opikHandler as any;
    
    // Check if flushAsync method exists (it might not be available in all versions)
    if (typeof handler.flushAsync === 'function') {
      await handler.flushAsync();
    } else if (typeof handler.flush === 'function') {
      await handler.flush();
    } else {
      // Handler exists but no flush method - that's okay
      console.debug("[Opik] No flush method available on handler");
    }
  } catch (error: any) {
    // Don't crash the app if flush fails (e.g., VPN issues, network errors)
    console.warn("[Opik] Failed to flush traces:", error?.message || error);
  }
}

