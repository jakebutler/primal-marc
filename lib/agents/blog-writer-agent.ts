import { BaseAgent, AgentConfig } from "./base";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { getOpikHandler } from "@/lib/utils/opik";

export class BlogWriterAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  async writeDraft(
    blogType: string,
    thesis: string,
    outline: any[],
    sources: any[],
    voiceTone: string,
    styleGuidelines: any = null
  ): Promise<string> {
    const promptTemplate = await this.loadPromptTemplate("blog_writer");
    
    const prompt = ChatPromptTemplate.fromTemplate(promptTemplate);
    const model = this.getModel();
    const parser = new StringOutputParser();

    const chain = prompt.pipe(model).pipe(parser);

    console.log("[BlogWriterAgent] Writing draft with inputs:");
    console.log("  Blog Type:", blogType || "N/A");
    console.log("  Thesis:", thesis?.substring(0, 100) || "N/A");
    console.log("  Outline sections:", outline?.length || 0);
    console.log("  Sources:", sources?.length || 0);
    console.log("  Voice/Tone:", voiceTone || "N/A");

    const opikHandler = getOpikHandler();
    const callbacks = opikHandler ? [opikHandler] : undefined;

    const result = await chain.invoke({
      blogType,
      thesis,
      outline: JSON.stringify(outline, null, 2),
      sources: JSON.stringify(sources, null, 2),
      voiceTone,
      styleGuidelines: styleGuidelines ? JSON.stringify(styleGuidelines, null, 2) : "",
    }, {
      callbacks: callbacks,
    });

    return result;
  }
}

