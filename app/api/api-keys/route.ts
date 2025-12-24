import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users, apiKeys } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/utils/encryption";

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }

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

    const keys = await db.select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id));

    return NextResponse.json({
      keys: keys.map(key => ({
        provider: key.provider,
        configured: true,
        lastUsed: key.lastUsed,
      })),
    });
  } catch (error: any) {
    console.error("Error getting API keys:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

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
    const { provider, apiKey } = body;

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Provider and apiKey are required" } },
        { status: 400 }
      );
    }

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

    const encryptedKey = encrypt(apiKey);

    // Check if key exists
    const [existing] = await db.select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.userId, user.id),
        eq(apiKeys.provider, provider as any)
      ))
      .limit(1);

    if (existing) {
      await db.update(apiKeys)
        .set({
          encryptedKey,
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, existing.id));
    } else {
      await db.insert(apiKeys).values({
        userId: user.id,
        provider: provider as any,
        encryptedKey,
      });
    }

    return NextResponse.json({
      success: true,
      provider,
    });
  } catch (error: any) {
    console.error("Error saving API key:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Provider is required" } },
        { status: 400 }
      );
    }

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

    await db.delete(apiKeys)
      .where(and(
        eq(apiKeys.userId, user.id),
        eq(apiKeys.provider, provider as any)
      ));

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("Error deleting API key:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

