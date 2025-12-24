import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { readFile } from "fs/promises";
import path from "path";
import { getOpikHandler } from "@/lib/utils/opik";

export type LLMProvider = "openai" | "anthropic";

export interface AgentConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  temperature?: number;
}

export class BaseAgent {
  protected config: AgentConfig;
  protected promptTemplate: string | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  protected async loadPromptTemplate(agentName: string): Promise<string> {
    if (this.promptTemplate) {
      return this.promptTemplate;
    }

    const promptPath = path.join(
      process.cwd(),
      "agents",
      `${agentName}_agent.md`
    );

    try {
      this.promptTemplate = await readFile(promptPath, "utf-8");
      return this.promptTemplate;
    } catch (error) {
      throw new Error(`Failed to load prompt template for ${agentName}: ${error}`);
    }
  }

  protected getModel() {
    const baseConfig = {
      temperature: this.config.temperature ?? 0.7,
    };

    if (this.config.provider === "openai") {
      return new ChatOpenAI({
        ...baseConfig,
        model: this.config.model || "gpt-4-turbo-preview",
        openAIApiKey: this.config.apiKey,
        maxRetries: 3,
      });
    } else {
      return new ChatAnthropic({
        ...baseConfig,
        model: this.config.model || "claude-3-sonnet-20240229",
        anthropicApiKey: this.config.apiKey,
        maxRetries: 3,
      });
    }
  }

  protected async executeAgent(
    promptTemplate: string,
    variables: Record<string, any>
  ): Promise<string> {
    const prompt = ChatPromptTemplate.fromTemplate(promptTemplate);
    const model = this.getModel();
    const parser = new StringOutputParser();

    const chain = prompt.pipe(model).pipe(parser);

    try {
      const opikHandler = getOpikHandler();
      const callbacks = opikHandler ? [opikHandler] : undefined;

      const result = await chain.invoke(variables, {
        callbacks: callbacks,
      });
      return result;
    } catch (error) {
      throw new Error(`Agent execution failed: ${error}`);
    }
  }
}

