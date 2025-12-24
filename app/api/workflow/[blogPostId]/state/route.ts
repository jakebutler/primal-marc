import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { WorkflowOrchestrator } from "@/lib/workflow/orchestrator";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
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

    const orchestrator = new WorkflowOrchestrator(params.blogPostId, blogPost.userId);
    const state = await orchestrator.getState();

    return NextResponse.json(state);
  } catch (error: any) {
    console.error("Error getting state:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

