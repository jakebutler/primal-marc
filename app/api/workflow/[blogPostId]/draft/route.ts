import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { blogPosts, thesisOutlines, researchSources, voiceToneSelections, blogDrafts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
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

    // Get necessary data from database
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

    const [research] = await db.select()
      .from(researchSources)
      .where(eq(researchSources.blogPostId, params.blogPostId))
      .limit(1);

    if (!research) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Research not found. Please complete the research step first." } },
        { status: 400 }
      );
    }

    const [voiceTone] = await db.select()
      .from(voiceToneSelections)
      .where(eq(voiceToneSelections.blogPostId, params.blogPostId))
      .limit(1);

    // Call AI worker to write draft
    const result = await callWorker("/draft", {
      userId: blogPost.userId,
      blogType: blogPost.blogType,
      thesis: thesisOutline.thesisStatement,
      outline: thesisOutline.outline,
      sources: research.sources || [],
      voiceTone: voiceTone?.selectedOptionName || "",
      styleGuidelines: voiceTone?.styleGuidelines || null,
    });

    const content = result.content;
    const wordCount = result.wordCount;

    // Save draft to database
    const existingDrafts = await db.select()
      .from(blogDrafts)
      .where(eq(blogDrafts.blogPostId, params.blogPostId))
      .orderBy(desc(blogDrafts.version))
      .limit(1);

    const latestVersion = existingDrafts.length > 0 && existingDrafts[0].version
      ? existingDrafts[0].version
      : 0;

    await db.insert(blogDrafts).values({
      blogPostId: params.blogPostId,
      content,
      wordCount,
      version: latestVersion + 1,
    });

    await db.update(blogPosts)
      .set({ status: "editorial_pending", updatedAt: new Date() })
      .where(eq(blogPosts.id, params.blogPostId));

    return NextResponse.json({
      content,
      wordCount,
      status: "editorial_pending",
    });
  } catch (error: any) {
    console.error("Error writing draft:", error);
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
    const { approved, goBackToStep } = body;

    if (!approved && goBackToStep) {
      // Update status to go back to specified step
      await db.update(blogPosts)
        .set({ status: `${goBackToStep}_pending` as any, updatedAt: new Date() })
        .where(eq(blogPosts.id, params.blogPostId));

      return NextResponse.json({
        status: `${goBackToStep}_pending`,
        currentStep: goBackToStep,
      });
    }

    if (approved) {
      return NextResponse.json({
        status: "editorial_pending",
        currentStep: "editorial",
      });
    }

    return NextResponse.json({
      status: "draft_pending",
      currentStep: "draft",
    });
  } catch (error: any) {
    console.error("Error updating draft approval:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  } finally {
    await flushOpikTraces();
  }
}

