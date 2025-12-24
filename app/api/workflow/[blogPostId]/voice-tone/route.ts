import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { WorkflowOrchestrator } from "@/lib/workflow/orchestrator";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { flushOpikTraces } from "@/lib/utils/opik";

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

    console.log("[VoiceTone API] Getting pre-defined voice/tone options for blog type:", blogPost.blogType);

    const orchestrator = new WorkflowOrchestrator(params.blogPostId, blogPost.userId);
    
    // Get pre-defined options (no LLM call needed)
    const result = await orchestrator.generateVoiceToneOptions(blogPost.blogType);
    
    const options = result?.options || [];

    if (options.length === 0) {
      console.warn("[VoiceTone API] Warning: No options returned from orchestrator");
    }

    return NextResponse.json({
      options: Array.isArray(options) ? options : [],
      status: "voice_tone_pending",
    });
  } catch (error: any) {
    console.error("Error getting voice/tone options:", error);
    console.error("Error stack:", error?.stack);
    console.error("Error details:", {
      message: error?.message,
      name: error?.name,
      cause: error?.cause,
    });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error?.message || "Unknown error occurred" } },
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
    const { selectedOptionId } = body;

    if (!selectedOptionId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "selectedOptionId is required" } },
        { status: 400 }
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

    const orchestrator = new WorkflowOrchestrator(params.blogPostId, blogPost.userId);
    
    // Get the options to find the selected one
    const state = await orchestrator.getState();
    // This would need to be stored or retrieved from state
    // For now, we'll get it from the request
    
    const { selectedOptionName, styleGuidelines } = body;
    
    await orchestrator.selectVoiceTone(selectedOptionId, selectedOptionName, styleGuidelines);

    return NextResponse.json({
      status: "thesis_pending",
      currentStep: "thesis",
    });
  } catch (error: any) {
    console.error("Error selecting voice/tone:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  } finally {
    await flushOpikTraces();
  }
}

