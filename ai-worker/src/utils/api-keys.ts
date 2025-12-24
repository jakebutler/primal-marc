import { db } from "../db";
import { apiKeys } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "./encryption";
import { AgentConfig } from "../agents/base";

/**
 * Get user's API key for a provider
 */
export async function getUserApiKey(
  userId: string,
  provider: "openai" | "anthropic"
): Promise<string | null> {
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)))
    .limit(1);

  if (!key) {
    return null;
  }

  try {
    return decrypt(key.encryptedKey);
  } catch (error) {
    throw new Error(`Failed to decrypt API key for ${provider}`);
  }
}

/**
 * Get agent config for a user, falling back to environment variables
 */
export async function getAgentConfig(
  userId: string,
  provider: "openai" | "anthropic" = "openai"
): Promise<AgentConfig> {
  const apiKey = await getUserApiKey(userId, provider);

  if (!apiKey) {
    // Try alternative provider
    const altProvider = provider === "openai" ? "anthropic" : "openai";
    const altKey = await getUserApiKey(userId, altProvider);

    if (!altKey) {
      // Fallback to environment variable
      const envKey =
        provider === "openai"
          ? process.env.OPENAI_API_KEY
          : process.env.ANTHROPIC_API_KEY;

      if (!envKey) {
        throw new Error(
          `No API key configured for ${provider} or ${altProvider}. Please configure your API keys in settings.`
        );
      }

      return { provider, apiKey: envKey };
    }

    return { provider: altProvider, apiKey: altKey };
  }

  return { provider, apiKey };
}

