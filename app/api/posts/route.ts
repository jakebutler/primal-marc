import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { blogPosts, finalPosts, users } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // Get user
    const [user] = await db.select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    // Get all completed blog posts for this user
    const completedPosts = await db.select({
      id: blogPosts.id,
      title: blogPosts.title,
      blogType: blogPosts.blogType,
      idea: blogPosts.idea,
      createdAt: blogPosts.createdAt,
      content: finalPosts.content,
    })
      .from(blogPosts)
      .leftJoin(finalPosts, eq(blogPosts.id, finalPosts.blogPostId))
      .where(and(
        eq(blogPosts.userId, user.id),
        eq(blogPosts.status, "completed")
      ))
      .orderBy(desc(blogPosts.createdAt));

    // Format posts for response
    const posts = completedPosts.map(post => ({
      id: post.id,
      title: post.title || "Untitled Post",
      blogType: post.blogType,
      idea: post.idea || "",
      content: post.content || "",
      createdAt: post.createdAt?.toISOString() || new Date().toISOString(),
      wordCount: post.content ? post.content.split(/\s+/).length : 0,
    }));

    return NextResponse.json({ posts });
  } catch (error: any) {
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

