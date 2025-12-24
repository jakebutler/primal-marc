import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { blogPosts, thesisOutlines, researchSources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { flushOpikTraces } from "@/lib/utils/opik";
import { callWorker } from "@/lib/utils/worker-client";

export async function POST(
  request: NextRequest,
  { params }: { params: { blogPostId: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const [blogPost] = await db.select()
      .from(blogPosts)
      .where(eq(blogPosts.id, params.blogPostId))
      .limit(1);

    if (!blogPost) {
      return NextResponse.json(
        { error: { code: "BLOG_POST_NOT_FOUND", message: "Blog post not found" } },
        { status: 404 }
      );
    }

    // Body is optional for research request
    let additionalResearchQuery: string | undefined;
    try {
      const body = await request.json().catch(() => ({}));
      additionalResearchQuery = body.additionalResearchQuery;
    } catch {
      // No body provided, that's fine
    }

    // Get thesis and outline from database
    const [thesisOutline] = await db.select()
      .from(thesisOutlines)
      .where(eq(thesisOutlines.blogPostId, params.blogPostId))
      .limit(1);

    if (!thesisOutline) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Thesis outline not found. Please complete the thesis step first." } },
        { status: 400 }
      );
    }

    // Call AI worker to perform research
    console.log("[Research API] Starting research...");
    const result = await callWorker("/research", {
      userId: blogPost.userId,
      thesis: thesisOutline.thesisStatement,
      outline: thesisOutline.outline,
      evidenceExpectations: thesisOutline.evidenceExpectations || [],
      perplexityApiKey: undefined, // Can be passed from user settings if needed
      exaApiKey: undefined,
    });
    console.log("[Research API] Research completed, sources count:", result?.sources?.length || 0);

    // Save research results to database
    const sources = Array.isArray(result.sources) ? result.sources : [];
    const sectionMapping = result.sectionMapping || {};

    const [existingResearch] = await db.select()
      .from(researchSources)
      .where(eq(researchSources.blogPostId, params.blogPostId))
      .limit(1);

    if (existingResearch) {
      await db.update(researchSources)
        .set({
          sources: sources as any,
          sectionMapping: sectionMapping as any,
          updatedAt: new Date(),
        })
        .where(eq(researchSources.blogPostId, params.blogPostId));
    } else {
      await db.insert(researchSources).values({
        blogPostId: params.blogPostId,
        sources: sources as any,
        sectionMapping: sectionMapping as any,
      });
    }
    
    await db.update(blogPosts)
      .set({ status: "draft_pending", updatedAt: new Date() })
      .where(eq(blogPosts.id, params.blogPostId));

    // Check if there was an error in the result
    if (result.error) {
      console.error("[Research API] Research returned error:", result.error);
      const statusCode = result.error.code === "VALIDATION_ERROR" ? 400 : 200;
      return NextResponse.json(
        { 
          error: result.error,
          sources: result.sources || [],
          sectionMapping: result.sectionMapping || {},
        },
        { status: statusCode }
      );
    }

    // Check if sources are empty and warn
    if (!result.sources || result.sources.length === 0) {
      console.warn("[Research API] Research returned empty sources array");
      return NextResponse.json({
        sources: [],
        sectionMapping: result.sectionMapping || {},
        suggestedRevisions: result.suggestedRevisions || {},
        status: "draft_pending",
        warning: "No research sources were found. This might be due to missing API keys (PERPLEXITY_API_KEY or EXA_API_KEY) or the research API failing.",
      });
    }

    return NextResponse.json({
      sources: result.sources || [],
      sectionMapping: result.sectionMapping || {},
      suggestedRevisions: result.suggestedRevisions || {},
      status: "draft_pending",
    });
  } catch (error: any) {
    console.error("Error researching:", error);
    console.error("Error stack:", error?.stack);
    const errorMessage = error?.message || "Unknown error occurred";
    
    // Return 200 with error info instead of 500, so frontend can handle it gracefully
    return NextResponse.json(
      { 
        error: { code: "AGENT_ERROR", message: errorMessage },
        sources: [],
        sectionMapping: {},
        suggestedRevisions: {},
      },
      { status: 200 }
    );
  } finally {
    await flushOpikTraces();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { blogPostId: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { requestAdditionalResearch } = body;

    if (requestAdditionalResearch) {
      // Re-run research
      return POST(request, { params });
    }

    return NextResponse.json({
      status: "draft_pending",
      currentStep: "draft",
    });
  } catch (error: any) {
    console.error("Error approving research:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  } finally {
    await flushOpikTraces();
  }
}

