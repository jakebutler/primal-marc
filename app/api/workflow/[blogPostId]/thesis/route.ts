import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { blogPosts, voiceToneSelections, thesisOutlines, researchSources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { flushOpikTraces } from "@/lib/utils/opik";
import { callWorker } from "@/lib/utils/worker-client";

// Fire-and-forget background research - doesn't block the response
async function startBackgroundResearch(blogPostId: string, userId: string) {
  console.log(`[Background Research] Starting for blogPostId: ${blogPostId}`);
  try {
    // Get thesis and outline from database
    const [thesisOutline] = await db.select()
      .from(thesisOutlines)
      .where(eq(thesisOutlines.blogPostId, blogPostId))
      .limit(1);

    if (!thesisOutline) {
      console.log(`[Background Research] No thesis outline found, skipping`);
      return;
    }

    // Call AI worker to perform research
    const result = await callWorker("/research", {
      userId,
      thesis: thesisOutline.thesisStatement,
      outline: thesisOutline.outline,
      evidenceExpectations: thesisOutline.evidenceExpectations || [],
    });
    
    // Save research results to database
    const sources = Array.isArray(result.sources) ? result.sources : [];
    const sectionMapping = result.sectionMapping || {};

    const [existingResearch] = await db.select()
      .from(researchSources)
      .where(eq(researchSources.blogPostId, blogPostId))
      .limit(1);

    if (existingResearch) {
      await db.update(researchSources)
        .set({
          sources: sources as any,
          sectionMapping: sectionMapping as any,
          updatedAt: new Date(),
        })
        .where(eq(researchSources.blogPostId, blogPostId));
    } else {
      await db.insert(researchSources).values({
        blogPostId,
        sources: sources as any,
        sectionMapping: sectionMapping as any,
      });
    }
    
    await db.update(blogPosts)
      .set({ status: "draft_pending", updatedAt: new Date() })
      .where(eq(blogPosts.id, blogPostId));

    console.log(`[Background Research] Completed for ${blogPostId}, sources: ${sources.length}`);
  } catch (error) {
    console.error(`[Background Research] Exception for ${blogPostId}:`, error);
  } finally {
    await flushOpikTraces();
  }
}

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

    const body = await request.json();
    const { idea: ideaFromBody } = body;
    
    // Get voice/tone selection
    const [voiceTone] = await db.select()
      .from(voiceToneSelections)
      .where(eq(voiceToneSelections.blogPostId, params.blogPostId))
      .limit(1);

    // Use idea from body if provided, otherwise get from blog post
    const idea = ideaFromBody || blogPost.idea || "Blog post idea";

    // Call AI worker to generate thesis
    const result = await callWorker("/thesis", {
      blogPostId: params.blogPostId,
      userId: blogPost.userId,
      idea,
      blogType: blogPost.blogType,
      voiceTone: voiceTone?.selectedOptionName || "",
      selectedThesisOption: undefined,
    });

    // Save thesis to database
    const [existing] = await db.select()
      .from(thesisOutlines)
      .where(eq(thesisOutlines.blogPostId, params.blogPostId))
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
        .where(eq(thesisOutlines.blogPostId, params.blogPostId));
    } else {
      await db.insert(thesisOutlines).values({
        blogPostId: params.blogPostId,
        thesisStatement: result.thesis,
        outline: result.outline as any,
        evidenceExpectations: result.evidenceExpectations as any || null,
        conclusionIntent: result.conclusionIntent || "",
      });
    }

    await db.update(blogPosts)
      .set({ status: "research_pending", updatedAt: new Date() })
      .where(eq(blogPosts.id, params.blogPostId));

    // Fire-and-forget: Start background research immediately after thesis is saved
    // This runs async without blocking the response to the client
    startBackgroundResearch(params.blogPostId, blogPost.userId).catch(err => {
      console.error("[Thesis API] Background research error (non-blocking):", err);
    });

    return NextResponse.json({
      thesis: result.thesis,
      outline: result.outline,
      conclusionIntent: result.conclusionIntent,
      status: "research_pending",
      backgroundResearchStarted: true,
    });
  } catch (error: any) {
    console.error("Error generating thesis:", error);
    return NextResponse.json(
      { error: { code: "AGENT_ERROR", message: error.message } },
      { status: 500 }
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
    const { thesis, outline } = body;

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

    // Check if thesis was actually edited by comparing with existing
    const [existingThesis] = await db.select()
      .from(thesisOutlines)
      .where(eq(thesisOutlines.blogPostId, params.blogPostId))
      .limit(1);

    const thesisChanged = existingThesis && (
      existingThesis.thesisStatement !== thesis ||
      JSON.stringify(existingThesis.outline) !== JSON.stringify(outline)
    );

    // Update thesis if provided
    if (thesis && outline && existingThesis) {
      await db.update(thesisOutlines)
        .set({
          thesisStatement: thesis,
          outline: outline as any,
          updatedAt: new Date(),
        })
        .where(eq(thesisOutlines.blogPostId, params.blogPostId));
      
      console.log(`[Thesis PUT] Updated thesis for ${params.blogPostId}, changed: ${thesisChanged}`);
    }

    // If thesis changed, clear existing research (it's now stale) and start new background research
    if (thesisChanged) {
      console.log(`[Thesis PUT] Thesis was edited, clearing stale research and starting fresh`);
      
      // Delete existing research since thesis changed
      await db.delete(researchSources)
        .where(eq(researchSources.blogPostId, params.blogPostId));
      
      // Fire-and-forget: Start new background research
      startBackgroundResearch(params.blogPostId, blogPost.userId).catch(err => {
        console.error("[Thesis PUT] Background research error (non-blocking):", err);
      });
    }

    await db.update(blogPosts)
      .set({ status: "research_pending", updatedAt: new Date() })
      .where(eq(blogPosts.id, params.blogPostId));

    return NextResponse.json({
      status: "research_pending",
      currentStep: "research",
      thesisUpdated: thesisChanged,
      backgroundResearchStarted: thesisChanged,
    });
  } catch (error: any) {
    console.error("Error updating thesis:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  } finally {
    await flushOpikTraces();
  }
}
