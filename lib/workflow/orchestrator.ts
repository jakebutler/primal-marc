import { db } from "@/lib/db";
import { blogPosts, blogPostStates, voiceToneSelections, thesisOutlines, researchSources, blogDrafts, finalPosts, apiKeys } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { IdeaRefinerAgent } from "@/lib/agents/idea-refiner-agent";
import { ResearchAgent } from "@/lib/agents/research-agent";
import { BlogWriterAgent } from "@/lib/agents/blog-writer-agent";
import { EditorialSEOAgent } from "@/lib/agents/editorial-seo-agent";
import { AgentConfig } from "@/lib/agents/base";
import { decrypt } from "@/lib/utils/encryption";
import { countWords } from "@/lib/utils/word-count";
import { getVoiceToneOptionsForBlogType } from "@/lib/data/voice-tone-presets";

export class WorkflowOrchestrator {
  private blogPostId: string;
  private userId: string;

  constructor(blogPostId: string, userId: string) {
    this.blogPostId = blogPostId;
    this.userId = userId;
  }

  private async getUserApiKey(provider: "openai" | "anthropic"): Promise<string | null> {
    const [key] = await db.select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.userId, this.userId),
        eq(apiKeys.provider, provider)
      ))
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

  private async getAgentConfig(provider: "openai" | "anthropic" = "openai"): Promise<AgentConfig> {
    const apiKey = await this.getUserApiKey(provider);
    
    if (!apiKey) {
      // Try alternative provider
      const altProvider = provider === "openai" ? "anthropic" : "openai";
      const altKey = await this.getUserApiKey(altProvider);
      
      if (!altKey) {
        // Fallback to environment variable
        const envKey = provider === "openai" 
          ? process.env.OPENAI_API_KEY 
          : process.env.ANTHROPIC_API_KEY;
        
        if (!envKey) {
          throw new Error(`No API key configured for ${provider} or ${altProvider}. Please configure your API keys in settings.`);
        }
        
        return { provider, apiKey: envKey };
      }
      
      return { provider: altProvider, apiKey: altKey };
    }

    return { provider, apiKey };
  }

  private async saveState(stepName: string, stateData: any): Promise<void> {
    await db.insert(blogPostStates).values({
      blogPostId: this.blogPostId,
      stepName: stepName as any,
      stateData: stateData as any,
    });
  }

  async generateVoiceToneOptions(blogType: string, thesis?: string): Promise<any> {
    try {
      // Validate: blog post must exist
      const [blogPost] = await db.select()
        .from(blogPosts)
        .where(eq(blogPosts.id, this.blogPostId))
        .limit(1);

      if (!blogPost) {
        throw new Error("Blog post not found");
      }

      console.log("[Orchestrator] Getting pre-defined voice/tone options for blog type:", blogType);
      
      // Get pre-defined options from presets
      const options = getVoiceToneOptionsForBlogType(blogType);
      
      if (options.length === 0) {
        console.warn("[Orchestrator] No voice/tone options found for blog type:", blogType);
        throw new Error(`No voice/tone options available for blog type: ${blogType}`);
      }
      
      console.log("[Orchestrator] Options retrieved, count:", options.length);
      
      // Save state for consistency with previous implementation
      await this.saveState("voice_tone", { options });
      console.log("[Orchestrator] State saved successfully");
      
      return { options };
    } catch (error: any) {
      console.error("[Orchestrator] Error in generateVoiceToneOptions:", error);
      console.error("[Orchestrator] Error stack:", error?.stack);
      console.error("[Orchestrator] Error details:", {
        message: error?.message,
        name: error?.name,
        cause: error?.cause,
      });
      throw error;
    }
  }

  async selectVoiceTone(optionId: string, optionName: string, styleGuidelines: any): Promise<void> {
    // Check if exists
    const [existing] = await db.select()
      .from(voiceToneSelections)
      .where(eq(voiceToneSelections.blogPostId, this.blogPostId))
      .limit(1);

    if (existing) {
      await db.update(voiceToneSelections)
        .set({
          selectedOptionId: optionId,
          selectedOptionName: optionName,
          styleGuidelines: styleGuidelines as any,
          updatedAt: new Date(),
        })
        .where(eq(voiceToneSelections.blogPostId, this.blogPostId));
    } else {
      await db.insert(voiceToneSelections).values({
        blogPostId: this.blogPostId,
        selectedOptionId: optionId,
        selectedOptionName: optionName,
        styleGuidelines: styleGuidelines as any,
      });
    }

    await db.update(blogPosts)
      .set({ status: "thesis_pending", updatedAt: new Date() })
      .where(eq(blogPosts.id, this.blogPostId));
  }

  async generateThesisOptions(idea: string, blogType: string, voiceTone: string): Promise<any> {
    const config = await this.getAgentConfig();
    const agent = new IdeaRefinerAgent(config);
    
    const result = await agent.generateThesisOptions(idea, blogType, voiceTone);
    
    await this.saveState("thesis", { options: result.options });
    
    return result;
  }

  async generateThesisAndOutline(idea: string, blogType: string, voiceTone: string, selectedThesisOption?: string): Promise<any> {
    // Validate: voice/tone must be selected first
    const [voiceToneSelection] = await db.select()
      .from(voiceToneSelections)
      .where(eq(voiceToneSelections.blogPostId, this.blogPostId))
      .limit(1);

    if (!voiceToneSelection) {
      throw new Error("Voice and tone must be selected before generating thesis");
    }

    if (!idea || idea.trim() === "") {
      throw new Error("Idea is required to generate thesis");
    }

    const config = await this.getAgentConfig();
    const agent = new IdeaRefinerAgent(config);
    
    const result = await agent.generateThesisAndOutline(idea, blogType, voiceTone, selectedThesisOption);
    
    const [existing] = await db.select()
      .from(thesisOutlines)
      .where(eq(thesisOutlines.blogPostId, this.blogPostId))
      .limit(1);

    if (existing) {
      await db.update(thesisOutlines)
        .set({
          thesisStatement: result.thesis,
          outline: result.outline as any,
          evidenceExpectations: result.evidenceExpectations as any || null,
          conclusionIntent: result.conclusionIntent || "",
          updatedAt: new Date(),
        })
        .where(eq(thesisOutlines.blogPostId, this.blogPostId));
    } else {
      await db.insert(thesisOutlines).values({
        blogPostId: this.blogPostId,
        thesisStatement: result.thesis,
        outline: result.outline as any,
        evidenceExpectations: result.evidenceExpectations as any || null,
        conclusionIntent: result.conclusionIntent || "",
      });
    }

    await db.update(blogPosts)
      .set({ status: "research_pending", updatedAt: new Date() })
      .where(eq(blogPosts.id, this.blogPostId));
    
    return result;
  }

  async research(perplexityApiKey?: string, exaApiKey?: string): Promise<any> {
    try {
      console.log(`[Research] Starting research for blogPostId: ${this.blogPostId}, userId: ${this.userId}`);
      
      const config = await this.getAgentConfig();
      console.log(`[Research] Got agent config, provider: ${config.provider}`);
      
      // Get research API keys from user or use app-level keys
      const perplexityKey = perplexityApiKey || process.env.PERPLEXITY_API_KEY;
      const exaKey = exaApiKey || process.env.EXA_API_KEY;
      
      // Debug: Check if env vars are loaded (without exposing the actual keys)
      console.log(`[Research] Environment check - PERPLEXITY_API_KEY exists: ${!!process.env.PERPLEXITY_API_KEY}, EXA_API_KEY exists: ${!!process.env.EXA_API_KEY}`);
      console.log(`[Research] PERPLEXITY_API_KEY length: ${process.env.PERPLEXITY_API_KEY?.length || 0}, EXA_API_KEY length: ${process.env.EXA_API_KEY?.length || 0}`);
      
      if (!perplexityKey && !exaKey) {
        console.error("[Research] No research API keys configured (PERPLEXITY_API_KEY or EXA_API_KEY)");
        console.error("[Research] Checked process.env.PERPLEXITY_API_KEY:", !!process.env.PERPLEXITY_API_KEY);
        console.error("[Research] Checked process.env.EXA_API_KEY:", !!process.env.EXA_API_KEY);
        throw new Error("Research API keys are not configured. Please set PERPLEXITY_API_KEY or EXA_API_KEY in your environment variables.");
      }
      
      console.log(`[Research] Using research API keys - Perplexity: ${perplexityKey ? `configured (${perplexityKey.substring(0, 10)}...)` : 'missing'}, Exa: ${exaKey ? `configured (${exaKey.substring(0, 10)}...)` : 'missing'}`);
      
      const agent = new ResearchAgent(config, perplexityKey, exaKey);
      
      const [blogPost] = await db.select()
        .from(blogPosts)
        .where(eq(blogPosts.id, this.blogPostId))
        .limit(1);

      if (!blogPost) {
        throw new Error("Blog post not found");
      }

      console.log(`[Research] Found blog post: ${blogPost.id}`);

      const [thesisOutline] = await db.select()
        .from(thesisOutlines)
        .where(eq(thesisOutlines.blogPostId, this.blogPostId))
        .limit(1);

      if (!thesisOutline) {
        throw new Error("Thesis outline not found. Please complete the thesis step first.");
      }

      console.log(`[Research] Found thesis outline`);

      const thesis = thesisOutline.thesisStatement || "";
      const outline = (thesisOutline.outline as any[]) || [];
      const evidenceExpectations = (thesisOutline.evidenceExpectations as any[]) || [];

      if (!thesis || outline.length === 0) {
        throw new Error("Thesis or outline is missing. Please complete the thesis step first.");
      }

      console.log(`[Research] Calling agent.research with thesis length: ${thesis.length}, outline sections: ${outline.length}, evidence expectations: ${evidenceExpectations.length}`);

      const result = await agent.research(
        thesis,
        outline,
        evidenceExpectations
      );

      console.log(`[Research] Agent returned result, sources count: ${result?.sources?.length || 0}`);

      // Ensure result has required structure
      if (!result || typeof result !== 'object') {
        throw new Error("Research agent returned invalid result");
      }

      const sources = Array.isArray(result.sources) ? result.sources : [];
      const sectionMapping = result.sectionMapping || {};

      const [existingResearch] = await db.select()
        .from(researchSources)
        .where(eq(researchSources.blogPostId, this.blogPostId))
        .limit(1);

      if (existingResearch) {
        await db.update(researchSources)
          .set({
            sources: sources as any,
            sectionMapping: sectionMapping as any,
            updatedAt: new Date(),
          })
          .where(eq(researchSources.blogPostId, this.blogPostId));
      } else {
        await db.insert(researchSources).values({
          blogPostId: this.blogPostId,
          sources: sources as any,
          sectionMapping: sectionMapping as any,
        });
      }

      console.log(`[Research] Saving ${sources.length} sources to database`);
      
      await db.update(blogPosts)
        .set({ status: "draft_pending", updatedAt: new Date() })
        .where(eq(blogPosts.id, this.blogPostId));
      
      console.log(`[Research] Research completed successfully`);
      
      return {
        sources,
        sectionMapping,
        suggestedRevisions: result.suggestedRevisions || {},
      };
    } catch (error: any) {
      console.error("[Research] Error in research orchestrator:", error);
      console.error("[Research] Error stack:", error?.stack);
      
      // Return structured error information instead of empty results
      // This allows the frontend to display helpful error messages
      const errorMessage = error?.message || "Unknown error occurred during research";
      const isValidationError = errorMessage.includes("not found") || errorMessage.includes("missing");
      
      return {
        sources: [],
        sectionMapping: {},
        suggestedRevisions: {},
        error: {
          message: errorMessage,
          code: isValidationError ? "VALIDATION_ERROR" : "RESEARCH_ERROR",
          recoverable: !isValidationError, // API errors are recoverable, validation errors are not
        },
      };
    }
  }

  async writeDraft(): Promise<string> {
    // Validate: thesis and research must be completed
    const [thesisOutline] = await db.select()
      .from(thesisOutlines)
      .where(eq(thesisOutlines.blogPostId, this.blogPostId))
      .limit(1);

    if (!thesisOutline) {
      throw new Error("Thesis outline not found. Please complete the thesis step first.");
    }

    const [research] = await db.select()
      .from(researchSources)
      .where(eq(researchSources.blogPostId, this.blogPostId))
      .limit(1);

    if (!research) {
      throw new Error("Research not found. Please complete the research step first.");
    }

    const config = await this.getAgentConfig();
    const agent = new BlogWriterAgent(config);
    
    // Get blog post for blog type
    const [blogPost] = await db.select()
      .from(blogPosts)
      .where(eq(blogPosts.id, this.blogPostId))
      .limit(1);

    if (!blogPost) {
      throw new Error("Blog post not found");
    }

    const [voiceTone] = await db.select()
      .from(voiceToneSelections)
      .where(eq(voiceToneSelections.blogPostId, this.blogPostId))
      .limit(1);

    console.log(`[WriteDraft] Writing draft for blog type: ${blogPost.blogType}`);
    console.log(`[WriteDraft] Thesis: ${thesisOutline.thesisStatement?.substring(0, 100)}...`);
    console.log(`[WriteDraft] Outline sections: ${(thesisOutline.outline as any[])?.length || 0}`);
    console.log(`[WriteDraft] Sources: ${(research?.sources as any[])?.length || 0}`);
    console.log(`[WriteDraft] Voice/Tone: ${voiceTone?.selectedOptionName || "N/A"}`);

    const content = await agent.writeDraft(
      blogPost.blogType,
      thesisOutline.thesisStatement,
      thesisOutline.outline as any[],
      research?.sources as any[] || [],
      voiceTone?.selectedOptionName || "",
      voiceTone?.styleGuidelines as any || null
    );

    const wordCount = countWords(content);

    // Get the latest version to create a new one
    const existingDrafts = await db.select()
      .from(blogDrafts)
      .where(eq(blogDrafts.blogPostId, this.blogPostId))
      .orderBy(desc(blogDrafts.version))
      .limit(1);

    const latestVersion = existingDrafts.length > 0 && existingDrafts[0].version
      ? existingDrafts[0].version
      : 0;

    // Always create a new version instead of updating
    await db.insert(blogDrafts).values({
      blogPostId: this.blogPostId,
      content,
      wordCount,
      version: latestVersion + 1,
    });

    await db.update(blogPosts)
      .set({ status: "editorial_pending", updatedAt: new Date() })
      .where(eq(blogPosts.id, this.blogPostId));
    
    return content;
  }

  async editAndOptimize(): Promise<any> {
    // Validate: draft must exist
    const drafts = await db.select()
      .from(blogDrafts)
      .where(eq(blogDrafts.blogPostId, this.blogPostId))
      .orderBy(desc(blogDrafts.version))
      .limit(1);
    
    const draft = drafts.length > 0 ? drafts[0] : null;

    if (!draft) {
      throw new Error("Draft not found. Please generate a draft first.");
    }

    // Get research sources to pass to editorial agent for proper citation formatting
    const [research] = await db.select()
      .from(researchSources)
      .where(eq(researchSources.blogPostId, this.blogPostId))
      .limit(1);

    const sourcesArray = research?.sources && Array.isArray(research.sources) ? research.sources : [];

    const config = await this.getAgentConfig();
    const agent = new EditorialSEOAgent(config);

    // Pass sources to agent for proper citation formatting
    const result = await agent.editAndOptimize(draft.content, sourcesArray);

    // Build citations from the sources we already have
    const citations: any[] = sourcesArray.map((source: any, index: number) => ({
      id: String(index + 1),
      url: source.url || "",
      title: source.title || "",
    }));

    const [existingFinal] = await db.select()
      .from(finalPosts)
      .where(eq(finalPosts.blogPostId, this.blogPostId))
      .limit(1);

    if (existingFinal) {
      await db.update(finalPosts)
        .set({
          content: result.finalContent,
          seoMetadata: result.seoMetadata as any,
          socialPosts: result.socialPosts as any,
          citations: citations as any,
          updatedAt: new Date(),
        })
        .where(eq(finalPosts.blogPostId, this.blogPostId));
    } else {
      await db.insert(finalPosts).values({
        blogPostId: this.blogPostId,
        content: result.finalContent,
        seoMetadata: result.seoMetadata as any,
        socialPosts: result.socialPosts as any,
        citations: citations as any,
      });
    }

    await db.update(blogPosts)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(blogPosts.id, this.blogPostId));
    
    return result;
  }

  async getState(): Promise<any> {
    const [blogPost] = await db.select()
      .from(blogPosts)
      .where(eq(blogPosts.id, this.blogPostId))
      .limit(1);

    if (!blogPost) {
      return null;
    }

    const [voiceTone] = await db.select()
      .from(voiceToneSelections)
      .where(eq(voiceToneSelections.blogPostId, this.blogPostId))
      .limit(1);

    const [thesisOutline] = await db.select()
      .from(thesisOutlines)
      .where(eq(thesisOutlines.blogPostId, this.blogPostId))
      .limit(1);

    const [research] = await db.select()
      .from(researchSources)
      .where(eq(researchSources.blogPostId, this.blogPostId))
      .limit(1);

    // Get the latest draft version
    const drafts = await db.select()
      .from(blogDrafts)
      .where(eq(blogDrafts.blogPostId, this.blogPostId))
      .orderBy(desc(blogDrafts.version))
      .limit(1);
    
    const draft = drafts.length > 0 ? drafts[0] : null;

    const [finalPost] = await db.select()
      .from(finalPosts)
      .where(eq(finalPosts.blogPostId, this.blogPostId))
      .limit(1);

    return {
      ...blogPost,
      voiceToneSelection: voiceTone || null,
      thesisOutline: thesisOutline || null,
      researchSources: research || null,
      draft: draft || null,
      finalPost: finalPost || null,
    };
  }
}
