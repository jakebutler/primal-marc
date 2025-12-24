import { BaseAgent, AgentConfig } from "./base";
import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getOpikHandler } from "../utils/opik";

const sourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  qualityScore: z.number().min(1).max(5),
  qualityRationale: z.string(),
  authority: z.number().min(1).max(5),
  relevance: z.number().min(1).max(5),
  recency: z.number().min(1).max(5),
  credibility: z.number().min(1).max(5),
  sectionMapping: z.array(z.number()),
});

const researchSchema = z.object({
  sources: z.array(sourceSchema),
  sectionMapping: z.record(z.string(), z.array(z.string())),
  suggestedRevisions: z.object({
    thesis: z.string().optional(),
    outline: z.array(z.any()).optional(),
  }).optional(),
});

export class ResearchAgent extends BaseAgent {
  private perplexityApiKey?: string;
  private exaApiKey?: string;

  constructor(config: AgentConfig, perplexityApiKey?: string, exaApiKey?: string) {
    super(config);
    this.perplexityApiKey = perplexityApiKey;
    this.exaApiKey = exaApiKey;
  }

  private async searchPerplexity(query: string): Promise<any> {
    console.log("[ResearchAgent] searchPerplexity called, has key:", !!this.perplexityApiKey);
    if (!this.perplexityApiKey) {
      if (this.exaApiKey) {
        console.log("[ResearchAgent] No Perplexity key, falling back to Exa");
        return this.searchExa(query);
      }
      console.warn("[ResearchAgent] No Perplexity API key configured, returning empty results");
      throw new Error("Perplexity API key is not configured");
    }

    try {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.perplexityApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            {
              role: "system",
              content: "You are a research assistant. Provide citations and sources.",
            },
            {
              role: "user",
              content: query,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[ResearchAgent] Perplexity API error:", response.status, errorText);
        if (this.exaApiKey) {
          console.log("[ResearchAgent] Falling back to Exa.ai");
          return this.searchExa(query);
        }
        throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("[ResearchAgent] Perplexity API response received, checking for citations...");
      
      if (data.search_results && Array.isArray(data.search_results) && data.search_results.length > 0) {
        console.log("[ResearchAgent] Found search_results array with", data.search_results.length, "items");
        const citations = data.search_results.map((result: any) => ({
          title: result.title || "",
          url: result.url || "",
          snippet: result.snippet || "",
          date: result.date || "",
        }));
        return { citations };
      }
      
      if (data.citations && Array.isArray(data.citations) && data.citations.length > 0) {
        console.log("[ResearchAgent] Found citations array (URL strings) with", data.citations.length, "items");
        const citations = data.citations.map((url: string) => ({
          title: "",
          url: url,
          snippet: "",
        }));
        return { citations };
      }
      
      console.warn("[ResearchAgent] No citations or search_results found in Perplexity response");
      return { citations: [] };
    } catch (error) {
      console.error("Perplexity search error:", error);
      if (this.exaApiKey) {
        try {
          return await this.searchExa(query);
        } catch (exaError) {
          console.error("Exa.ai also failed:", exaError);
        }
      }
      return { citations: [] };
    }
  }

  private async searchExa(query: string): Promise<any> {
    if (!this.exaApiKey) {
      throw new Error("Exa API key not configured");
    }

    try {
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "x-api-key": this.exaApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          num_results: 10,
          contents: {
            text: true,
            highlights: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Exa API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Research API failed: ${error}`);
    }
  }

  async research(
    thesis: string,
    outline: any[],
    evidenceExpectations: any[]
  ): Promise<z.infer<typeof researchSchema>> {
    const promptTemplate = await this.loadPromptTemplate("research");
    
    const searchQueries = [
      thesis,
      ...outline.map((section: any) => `${section.title}: ${section.purpose}`),
    ].join(" ");

    let searchResults: any = { citations: [] };
    try {
      console.log("[ResearchAgent] Starting search with Perplexity...");
      searchResults = await this.searchPerplexity(searchQueries);
      console.log("[ResearchAgent] Search completed, citations count:", searchResults?.citations?.length || 0);
      if (!searchResults || !searchResults.citations) {
        console.warn("[ResearchAgent] Search returned no citations");
        searchResults = { citations: [] };
      }
    } catch (error: any) {
      console.error("[ResearchAgent] Search failed:", error?.message || error);
      searchResults = { citations: [] };
    }

    const sources: any[] = [];
    
    if (searchResults.citations && Array.isArray(searchResults.citations)) {
      console.log("[ResearchAgent] Found", searchResults.citations.length, "citations");
      searchResults.citations.forEach((citation: any, index: number) => {
        sources.push({
          id: `source-${index + 1}`,
          title: citation.title || "Source",
          url: citation.url || "",
          qualityScore: 4,
          qualityRationale: "Source from Perplexity API",
          authority: 4,
          relevance: 5,
          recency: 4,
          credibility: 4,
          sectionMapping: [1],
        });
      });
    }
    
    console.log("[ResearchAgent] Created", sources.length, "sources from citations");

    const parser = StructuredOutputParser.fromZodSchema(researchSchema);
    
    const searchResultsStr = JSON.stringify(searchResults).replace(/\{/g, "{{").replace(/\}/g, "}}");
    
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `{formatInstructions}\n${promptTemplate}\n\nYou have access to these search results: {searchResults}`],
      ["user", "Thesis: {thesis}\nOutline: {outline}\nEvidence Expectations: {evidenceExpectations}\n\nAnalyze the search results and provide structured sources with quality scores."],
    ]);

    const model = this.getModel();
    const chain = prompt.pipe(model).pipe(parser);

    try {
      console.log("[ResearchAgent] Invoking LLM to structure sources...");
      
      const opikHandler = getOpikHandler();
      const callbacks = opikHandler ? [opikHandler] : undefined;

      const result = await chain.invoke({
        formatInstructions: parser.getFormatInstructions(),
        thesis,
        outline: JSON.stringify(outline),
        evidenceExpectations: JSON.stringify(evidenceExpectations),
        searchResults: searchResultsStr,
      }, {
        callbacks: callbacks,
      });

      if (result.sources && sources.length > 0) {
        console.log("[ResearchAgent] Merging LLM sources with search URLs");
        result.sources = result.sources.map((source: any, index: number) => ({
          ...source,
          url: sources[index]?.url || source.url || "",
        }));
      }

      const finalSources = Array.isArray(result.sources) ? result.sources : (sources.length > 0 ? sources.slice(0, 5) : []);
      console.log("[ResearchAgent] Returning", finalSources.length, "final sources");
      
      return {
        sources: finalSources,
        sectionMapping: result.sectionMapping || {},
        suggestedRevisions: result.suggestedRevisions || {},
      };
    } catch (error: any) {
      console.error("[ResearchAgent] LLM processing failed:", error?.message || error);
      
      const fallbackSources = sources.length > 0 ? sources.slice(0, 5) : [];
      console.log("[ResearchAgent] Returning", fallbackSources.length, "fallback sources after LLM failure");
      
      return {
        sources: fallbackSources,
        sectionMapping: {},
        suggestedRevisions: {},
      };
    }
  }
}

