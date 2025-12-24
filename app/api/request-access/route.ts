import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accessRequests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Simple email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Email is required" } },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!isValidEmail(trimmedEmail)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid email format" } },
        { status: 400 }
      );
    }

    // Check if request already exists
    const [existingRequest] = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.email, trimmedEmail))
      .limit(1);

    if (existingRequest) {
      // Return success even if already exists (don't reveal if email exists)
      return NextResponse.json({
        message: "Access request received. We'll review your request and send an invitation if approved.",
      });
    }

    // Create new access request
    await db.insert(accessRequests).values({
      email: trimmedEmail,
      status: "pending",
    });

    return NextResponse.json({
      message: "Access request received. We'll review your request and send an invitation if approved.",
    });
  } catch (error: any) {
    console.error("Error creating access request:", error);
    
    // Handle unique constraint violation (race condition)
    if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
      return NextResponse.json({
        message: "Access request received. We'll review your request and send an invitation if approved.",
      });
    }

    // Handle table doesn't exist error (migration not run)
    if (error.message?.includes("does not exist") || error.message?.includes("relation") || error.message?.includes("table")) {
      console.error("Database table missing - migration may not have been run:", error.message);
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: "Service temporarily unavailable. Please try again later." } },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to process access request" } },
      { status: 500 }
    );
  }
}

