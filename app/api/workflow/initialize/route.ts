import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { blogPosts, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { idea, blogType } = body;

    if (!idea || !blogType) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Idea and blogType are required" } },
        { status: 400 }
      );
    }

    // Get or create user
    const [existingUser] = await db.select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    let user = existingUser;

    if (!user) {
      const clerkUser = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      }).then(res => res.json());

      const [newUser] = await db.insert(users).values({
        clerkUserId,
        email: clerkUser.email_addresses?.[0]?.email_address || "",
      }).returning();

      user = newUser;
    }

    // Create blog post
    const [blogPost] = await db.insert(blogPosts).values({
      userId: user.id,
      idea: idea, // Store the initial idea
      blogType: blogType as any,
      status: "voice_tone_pending",
    }).returning();

    return NextResponse.json({
      blogPostId: blogPost.id,
      status: "voice_tone_pending",
      currentStep: "voice_tone",
    });
  } catch (error: any) {
    console.error("Error initializing workflow:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

