import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { blogPosts, finalPosts } from "@/lib/db/schema";
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

    const [finalPost] = await db.select()
      .from(finalPosts)
      .where(eq(finalPosts.blogPostId, params.blogPostId))
      .limit(1);

    if (!finalPost) {
      return NextResponse.json(
        { error: { code: "BLOG_POST_NOT_FOUND", message: "Final post not found" } },
        { status: 404 }
      );
    }
    const seoMetadata = finalPost.seoMetadata as any;
    const socialPosts = finalPost.socialPosts as any;
    const citations = finalPost.citations as any[];

    // Generate markdown
    let markdown = `---\n`;
    markdown += `title: ${seoMetadata.title}\n`;
    markdown += `description: ${seoMetadata.metaDescription}\n`;
    markdown += `---\n\n`;
    markdown += `# ${seoMetadata.title}\n\n`;
    markdown += `${finalPost.content}\n\n`;
    
    if (citations && citations.length > 0) {
      markdown += `---\n\n## Citations\n\n`;
      citations.forEach((citation, index) => {
        markdown += `[${index + 1}]: ${citation.url} - ${citation.title || "Source"}\n`;
      });
      markdown += `\n`;
    }

    markdown += `---\n\n## Social Posts\n\n`;
    markdown += `### Twitter/X\n`;
    markdown += `${socialPosts.twitter}\n\n`;
    markdown += `### LinkedIn\n`;
    markdown += `${socialPosts.linkedin}\n`;

    // Generate filename from title, idea, or default
    let filename = "blog-post";
    if (blogPost.title) {
      filename = blogPost.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    } else if (blogPost.idea) {
      // Use first 50 chars of idea for filename
      filename = blogPost.idea.substring(0, 50).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    }

    return NextResponse.json({
      markdown,
      filename: `${filename}.md`,
    });
  } catch (error: any) {
    console.error("Error exporting:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

