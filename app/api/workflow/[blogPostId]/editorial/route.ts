import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { blogPosts, blogDrafts, researchSources, finalPosts } from "@/lib/db/schema";
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

    // Get latest draft
    const drafts = await db.select()
      .from(blogDrafts)
      .where(eq(blogDrafts.blogPostId, params.blogPostId))
      .orderBy(desc(blogDrafts.version))
      .limit(1);
    
    const draft = drafts.length > 0 ? drafts[0] : null;

    if (!draft) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Draft not found. Please generate a draft first." } },
        { status: 400 }
      );
    }

    // Get research sources for citations
    const [research] = await db.select()
      .from(researchSources)
      .where(eq(researchSources.blogPostId, params.blogPostId))
      .limit(1);

    const sourcesArray = research?.sources && Array.isArray(research.sources) ? research.sources : [];

    // Call AI worker to edit and optimize
    const result = await callWorker("/editorial", {
      userId: blogPost.userId,
      draft: draft.content,
      sources: sourcesArray,
    });

    // Build citations from sources
    const citations: any[] = sourcesArray.map((source: any, index: number) => ({
      id: String(index + 1),
      url: source.url || "",
      title: source.title || "",
    }));

    // Save final post to database
    const [existingFinal] = await db.select()
      .from(finalPosts)
      .where(eq(finalPosts.blogPostId, params.blogPostId))
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
        .where(eq(finalPosts.blogPostId, params.blogPostId));
    } else {
      await db.insert(finalPosts).values({
        blogPostId: params.blogPostId,
        content: result.finalContent,
        seoMetadata: result.seoMetadata as any,
        socialPosts: result.socialPosts as any,
        citations: citations as any,
      });
    }

    await db.update(blogPosts)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(blogPosts.id, params.blogPostId));

    return NextResponse.json({
      finalContent: result.finalContent,
      seoMetadata: result.seoMetadata,
      socialPosts: result.socialPosts,
      status: "completed",
    });
  } catch (error: any) {
    console.error("Error editing and optimizing:", error);
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
    const { seoMetadata, socialPosts } = body;

    const [finalPost] = await db.select()
      .from(finalPosts)
      .where(eq(finalPosts.blogPostId, params.blogPostId))
      .limit(1);

    if (!finalPost) {
      return NextResponse.json(
        { error: { code: "FINAL_POST_NOT_FOUND", message: "Final post not found. Please generate it first." } },
        { status: 404 }
      );
    }

    // Update SEO metadata and social posts
    await db.update(finalPosts)
      .set({
        seoMetadata: seoMetadata as any,
        socialPosts: socialPosts as any,
        updatedAt: new Date(),
      })
      .where(eq(finalPosts.blogPostId, params.blogPostId));

    return NextResponse.json({
      status: "updated",
      message: "SEO metadata and social posts saved successfully",
    });
  } catch (error: any) {
    console.error("Error updating final post:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  } finally {
    await flushOpikTraces();
  }
}

