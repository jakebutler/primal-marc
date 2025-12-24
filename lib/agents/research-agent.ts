import { BaseAgent, AgentConfig } from "./base";
import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getOpikHandler } from "@/lib/utils/opik";

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
      // If no Perplexity key, try Exa or return empty
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
        // Fallback to Exa.ai
        if (this.exaApiKey) {
          console.log("[ResearchAgent] Falling back to Exa.ai");
          return this.searchExa(query);
        }
        throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("[ResearchAgent] Perplexity API response received, checking for citations...");
      console.log("[ResearchAgent] Response structure:", {
        hasCitations: !!data.citations,
        citationsCount: data.citations?.length || 0,
        hasSearchResults: !!data.search_results,
        searchResultsCount: data.search_results?.length || 0,
        hasChoices: !!data.choices,
        choicesCount: data.choices?.length || 0,
      });
      
      // Perplexity API returns citations as URL strings and search_results with detailed info
      // We should use search_results for the detailed source information
      if (data.search_results && Array.isArray(data.search_results) && data.search_results.length > 0) {
        console.log("[ResearchAgent] Found search_results array with", data.search_results.length, "items");
        // Convert search_results to citations format for compatibility
        const citations = data.search_results.map((result: any) => ({
          title: result.title || "",
          url: result.url || "",
          snippet: result.snippet || "",
          date: result.date || "",
        }));
        return { citations };
      }
      
      // Fallback: if we have citations (URL strings), convert them to objects
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
      // Fallback to Exa.ai
      if (this.exaApiKey) {
        try {
          return await this.searchExa(query);
        } catch (exaError) {
          console.error("Exa.ai also failed:", exaError);
        }
      }
      // Return empty results instead of throwing
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
    
    // Create search queries from thesis and outline
    const searchQueries = [
      thesis,
      ...outline.map((section: any) => `${section.title}: ${section.purpose}`),
    ].join(" ");

    // Perform search
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
      console.error("[ResearchAgent] Search error stack:", error?.stack);
      searchResults = { citations: [] };
    }

    // Parse search results and create sources
    const sources: any[] = [];
    console.log("[ResearchAgent] Parsing search results, citations type:", typeof searchResults.citations, "isArray:", Array.isArray(searchResults.citations));
    console.log("[ResearchAgent] Full searchResults structure:", JSON.stringify(searchResults, null, 2).substring(0, 500));
    
    if (searchResults.citations && Array.isArray(searchResults.citations)) {
      console.log("[ResearchAgent] Found", searchResults.citations.length, "citations");
      searchResults.citations.forEach((citation: any, index: number) => {
        console.log(`[ResearchAgent] Citation ${index + 1}:`, { title: citation.title, url: citation.url });
        sources.push({
          id: `source-${index + 1}`,
          title: citation.title || "Source",
          url: citation.url || "",
          qualityScore: 4, // Default score, would be calculated properly
          qualityRationale: "Source from Perplexity API",
          authority: 4,
          relevance: 5,
          recency: 4,
          credibility: 4,
          sectionMapping: [1], // Default to first section
        });
      });
    } else {
      console.warn("[ResearchAgent] No citations found in searchResults or citations is not an array");
    }
    
    console.log("[ResearchAgent] Created", sources.length, "sources from citations");

    // Use LLM to structure and score sources
    const parser = StructuredOutputParser.fromZodSchema(researchSchema);
    
    // Serialize search results to avoid template parsing issues with curly braces
    const searchResultsStr = JSON.stringify(searchResults).replace(/\{/g, "{{").replace(/\}/g, "}}");
    
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `{formatInstructions}\n${promptTemplate}\n\nYou have access to these search results: {searchResults}`],
      ["user", "Thesis: {thesis}\nOutline: {outline}\nEvidence Expectations: {evidenceExpectations}\n\nAnalyze the search results and provide structured sources with quality scores."],
    ]);

    const model = this.getModel();
    const chain = prompt.pipe(model).pipe(parser);

    try {
      console.log("[ResearchAgent] Invoking LLM to structure sources...");
      console.log("[ResearchAgent] Input - thesis length:", thesis.length, "outline sections:", outline.length, "evidence expectations:", evidenceExpectations.length);
      console.log("[ResearchAgent] Sources to process:", sources.length);
      
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

      console.log("[ResearchAgent] LLM returned result:", {
        hasSources: !!result.sources,
        sourcesCount: result.sources?.length || 0,
        hasSectionMapping: !!result.sectionMapping,
        hasSuggestedRevisions: !!result.suggestedRevisions,
      });

      // Merge LLM-structured sources with actual URLs from search
      if (result.sources && sources.length > 0) {
        console.log("[ResearchAgent] Merging LLM sources with search URLs");
        result.sources = result.sources.map((source: any, index: number) => ({
          ...source,
          url: sources[index]?.url || source.url || "",
        }));
      }

      // Ensure we always return valid structure
      const finalSources = Array.isArray(result.sources) ? result.sources : (sources.length > 0 ? sources.slice(0, 5) : []);
      console.log("[ResearchAgent] Returning", finalSources.length, "final sources");
      
      return {
        sources: finalSources,
        sectionMapping: result.sectionMapping || {},
        suggestedRevisions: result.suggestedRevisions || {},
      };
    } catch (error: any) {
      console.error("[ResearchAgent] LLM processing failed:", error?.message || error);
      console.error("[ResearchAgent] LLM error stack:", error?.stack);
      
      // Return basic sources if LLM fails
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
