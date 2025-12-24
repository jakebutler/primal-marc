import { BaseAgent, AgentConfig } from "./base";
import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getOpikHandler } from "@/lib/utils/opik";

const editorialSchema = z.object({
  finalContent: z.string(),
  seoMetadata: z.object({
    title: z.string(),
    metaDescription: z.string(),
    h2Suggestions: z.array(z.string()),
  }),
  socialPosts: z.object({
    twitter: z.string(),
    linkedin: z.string(),
  }),
});

export class EditorialSEOAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  async editAndOptimize(draft: string, sources?: any[]): Promise<z.infer<typeof editorialSchema>> {
    const promptTemplate = await this.loadPromptTemplate("editorial_and_seo");
    
    const parser = StructuredOutputParser.fromZodSchema(editorialSchema);
    
    // Include sources information for proper citation formatting
    const sourcesInfo = sources && sources.length > 0 
      ? `\n\nAvailable sources for citations (use markdown format [title](url)):\n${sources.map((s, i) => `- Source ${i + 1}: "${s.title}" - ${s.url}`).join('\n')}`
      : '';
    
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `{formatInstructions}\n${promptTemplate}${sourcesInfo}`],
      ["user", "Draft: {draft}\n\nIMPORTANT: Ensure all source citations use proper markdown link format [descriptive text](URL). Replace any references like 'source1', 'source2', etc. with proper markdown links using the sources provided above. Use at least 3 different sources."],
    ]);

    const model = this.getModel();
    const chain = prompt.pipe(model).pipe(parser);

    const opikHandler = getOpikHandler();
    const callbacks = opikHandler ? [opikHandler] : undefined;

    const result = await chain.invoke({
      formatInstructions: parser.getFormatInstructions(),
      draft,
    }, {
      callbacks: callbacks,
    });

    return result;
  }
}

