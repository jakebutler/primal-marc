import { BaseAgent, AgentConfig } from "./base";
import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getOpikHandler } from "@/lib/utils/opik";

const thesisSchema = z.object({
  thesis: z.string(),
  outline: z.array(
    z.object({
      sectionNumber: z.number(),
      title: z.string(),
      purpose: z.string(),
      evidenceType: z.string().describe("The type of evidence needed: 'research' for stats/studies, 'examples' for case studies/real-world instances, 'expert_quotes' for authority opinions, 'data_points' for specific metrics, 'analogies' for comparative explanations"),
      evidenceGuidance: z.string().describe("Specific guidance on what research should look for - include example search queries, types of sources to find (academic papers, industry reports, news articles), and specific data points or quotes that would strengthen this section"),
    })
  ),
  evidenceExpectations: z.array(
    z.object({
      sectionNumber: z.number(),
      evidenceType: z.string(),
      searchQueries: z.array(z.string()).describe("2-3 specific search queries to find relevant sources"),
      sourceTypes: z.array(z.string()).describe("Types of sources to prioritize (e.g., 'academic papers', 'industry reports', 'expert blogs', 'news articles')"),
      keyDataPoints: z.array(z.string()).describe("Specific statistics, quotes, or facts that would strengthen this section"),
      description: z.string(),
    })
  ),
  conclusionIntent: z.string(),
});

const thesisOptionsSchema = z.object({
  options: z.array(
    z.object({
      id: z.string(),
      thesis: z.string(),
      implications: z.string(),
      audience: z.string(),
    })
  ).min(2).max(3),
});

export class IdeaRefinerAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  async generateThesisOptions(
    idea: string,
    blogType: string,
    voiceTone: string
  ): Promise<z.infer<typeof thesisOptionsSchema>> {
    const promptTemplate = await this.loadPromptTemplate("idea_refiner");
    
    const parser = StructuredOutputParser.fromZodSchema(thesisOptionsSchema);
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `{formatInstructions}\n${promptTemplate}`],
      ["user", "Idea: {idea}\nBlog Type: {blogType}\nVoice/Tone: {voiceTone}"],
    ]);

    const model = this.getModel();
    const chain = prompt.pipe(model).pipe(parser);

    const opikHandler = getOpikHandler();
    const callbacks = opikHandler ? [opikHandler] : undefined;

    const result = await chain.invoke({
      formatInstructions: parser.getFormatInstructions(),
      idea,
      blogType,
      voiceTone,
    }, {
      callbacks: callbacks,
    });

    return result;
  }

  async generateThesisAndOutline(
    idea: string,
    blogType: string,
    voiceTone: string,
    selectedThesisOption?: string
  ): Promise<z.infer<typeof thesisSchema>> {
    const promptTemplate = await this.loadPromptTemplate("idea_refiner");
    
    const parser = StructuredOutputParser.fromZodSchema(thesisSchema);
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `{formatInstructions}\n${promptTemplate}`],
      ["user", "Idea: {idea}\nBlog Type: {blogType}\nVoice/Tone: {voiceTone}\nSelected Thesis Option: {selectedThesis}"],
    ]);

    const model = this.getModel();
    const chain = prompt.pipe(model).pipe(parser);

    const opikHandler = getOpikHandler();
    const callbacks = opikHandler ? [opikHandler] : undefined;

    const result = await chain.invoke({
      formatInstructions: parser.getFormatInstructions(),
      idea,
      blogType,
      voiceTone,
      selectedThesis: selectedThesisOption || "Generate new thesis",
    }, {
      callbacks: callbacks,
    });

    return result;
  }
}

