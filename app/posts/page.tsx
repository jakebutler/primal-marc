"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExpandableBlogCard } from "@/components/ui/expandable-blog-card";
import { Plus } from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  blogType: string;
  idea: string;
  content: string;
  createdAt: string;
  wordCount: number;
}

export default function PostsPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/");
      return;
    }

    if (isLoaded && isSignedIn) {
      fetchPosts();
    }
  }, [isLoaded, isSignedIn, router]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/posts");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: "Failed to fetch posts" } }));
        throw new Error(errorData.error?.message || "Failed to fetch posts");
      }

      const data = await response.json();
      setPosts(data.posts || []);
    } catch (err: any) {
      console.error("Error fetching posts:", err);
      setError(err.message || "Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return null; // Will redirect
  }

  // Generate preview text from content, skipping the headline
  const getPreview = (post: BlogPost): string => {
    if (post.content) {
      const lines = post.content.split("\n");
      let startIndex = 0;
      
      // Skip the first heading (headline)
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().match(/^#{1,2}\s+/)) {
          startIndex = i + 1;
          break;
        }
      }
      
      // Get content after headline, remove remaining headers and formatting
      const bodyText = lines.slice(startIndex).join("\n")
        .replace(/^#+\s+/gm, "")
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links but keep text
        .trim();
      
      return bodyText.substring(0, 200) + (bodyText.length > 200 ? "..." : "");
    }
    return post.idea || "No preview available";
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground">My Blog Posts</h1>
            <Button onClick={() => router.push("/")}>
              <Plus className="mr-2 h-4 w-4" />
              New Post
            </Button>
          </div>
          <p className="text-muted-foreground">
            View and copy your generated blog posts
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-muted rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-muted rounded w-full mb-2"></div>
                  <div className="h-4 bg-muted rounded w-5/6"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <Card>
            <CardContent className="p-6">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={fetchPosts} variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && posts.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-xl font-semibold mb-2">No blog posts yet</h3>
              <p className="text-muted-foreground mb-6">
                Start creating your first blog post to see it here.
              </p>
              <Button onClick={() => router.push("/")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Post
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Posts List */}
        {!loading && !error && posts.length > 0 && (
          <div className="space-y-4">
            {posts.map((post) => (
              <ExpandableBlogCard
                key={post.id}
                id={post.id}
                title={post.title}
                blogType={post.blogType}
                preview={getPreview(post)}
                content={post.content}
                createdAt={post.createdAt}
                wordCount={post.wordCount}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

