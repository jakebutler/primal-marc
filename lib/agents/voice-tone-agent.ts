/**
 * @deprecated This agent is deprecated. Voice/tone options are now pre-defined in lib/data/voice-tone-presets.ts
 * and returned instantly without LLM calls. This class is kept for potential future "custom voice" features.
 */
import { BaseAgent, AgentConfig } from "./base";
import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getOpikHandler } from "@/lib/utils/opik";

const voiceToneSchema = z.object({
  options: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      style: z.object({
        writingStyle: z.string(),
        formality: z.string(),
        emotionalPosture: z.string(),
      }),
    })
  ).length(3),
});

/**
 * @deprecated Use getVoiceToneOptionsForBlogType from lib/data/voice-tone-presets.ts instead
 */
export class VoiceToneAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  async generateOptions(blogType: string, thesis?: string): Promise<z.infer<typeof voiceToneSchema>> {
    try {
      const promptTemplate = await this.loadPromptTemplate("voice_and_tone");
      
      const parser = StructuredOutputParser.fromZodSchema(voiceToneSchema);
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", `{formatInstructions}\n${promptTemplate}`],
        ["user", "Blog type: {blogType}\nThesis: {thesis}"],
      ]);

      const model = this.getModel();
      const chain = prompt.pipe(model).pipe(parser);

      // Get Opik handler, but don't fail if it's not available
      let callbacks;
      try {
        const opikHandler = getOpikHandler();
        callbacks = opikHandler ? [opikHandler] : undefined;
      } catch (opikError) {
        console.warn("[VoiceToneAgent] Opik handler failed, continuing without tracing:", opikError);
        callbacks = undefined;
      }

      // Only pass callbacks if we have them
      const invokeOptions = callbacks ? { callbacks } : undefined;

      const result = await chain.invoke({
        formatInstructions: parser.getFormatInstructions(),
        blogType,
        thesis: thesis || "Not provided",
      }, invokeOptions);

      return result;
    } catch (error: any) {
      console.error("Error in VoiceToneAgent.generateOptions:", error);
      throw new Error(`Failed to generate voice/tone options: ${error?.message || error}`);
    }
  }
}

