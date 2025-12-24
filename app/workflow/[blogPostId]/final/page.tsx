"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkflowLoading } from "@/components/workflow/workflow-loading";
import dynamic from "next/dynamic";
import { LOADING_MESSAGES } from "@/lib/loading-messages";
import { MarkdownViewer } from "@/components/ui/markdown-viewer";
import { Eye, Code } from "lucide-react";

const AILoading = dynamic(() => import("@/components/kokonutui/ai-loading").then(mod => mod.default), {
  ssr: false,
});

export default function FinalPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const blogPostId = params.blogPostId as string;
  
  const [finalPost, setFinalPost] = useState<any>(null);
  const [seoMetadata, setSeoMetadata] = useState<any>({});
  const [socialPosts, setSocialPosts] = useState<any>({});
  const [initialSeoMetadata, setInitialSeoMetadata] = useState<any>({});
  const [initialSocialPosts, setInitialSocialPosts] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isPreviewFlipped, setIsPreviewFlipped] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if we should start generating immediately (from draft approval)
  const shouldAutoGenerate = searchParams.get('generating') === 'true';

  const pollForFinalPost = useCallback(async () => {
    try {
      const response = await fetch(`/api/workflow/${blogPostId}/state`);
      if (response.ok) {
        const data = await response.json();
        if (data.finalPost?.content) {
          setFinalPost(data.finalPost);
          const seo = data.finalPost.seoMetadata || {};
          const social = data.finalPost.socialPosts || {};
          setSeoMetadata(seo);
          setSocialPosts(social);
          setInitialSeoMetadata(seo);
          setInitialSocialPosts(social);
          setGenerating(false);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          // Remove the generating query param without scrolling to top
          router.replace(`/workflow/${blogPostId}/final`, { scroll: false });
        }
      }
    } catch (error) {
      console.error("Error polling for final post:", error);
    }
  }, [blogPostId, router]);

  useEffect(() => {
    loadState();
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [blogPostId]);

  // Track changes to enable/disable save button
  useEffect(() => {
    const seoChanged = JSON.stringify(seoMetadata) !== JSON.stringify(initialSeoMetadata);
    const socialChanged = JSON.stringify(socialPosts) !== JSON.stringify(initialSocialPosts);
    setHasChanges(seoChanged || socialChanged);
  }, [seoMetadata, socialPosts, initialSeoMetadata, initialSocialPosts]);

  const loadState = async () => {
    try {
      const response = await fetch(`/api/workflow/${blogPostId}/state`);
      if (response.ok) {
        const data = await response.json();
        if (data.finalPost?.content) {
          setFinalPost(data.finalPost);
          const seo = data.finalPost.seoMetadata || {};
          const social = data.finalPost.socialPosts || {};
          setSeoMetadata(seo);
          setSocialPosts(social);
          setInitialSeoMetadata(seo);
          setInitialSocialPosts(social);
        } else if (shouldAutoGenerate) {
          // Final post is being generated, start polling
          setGenerating(true);
          pollIntervalRef.current = setInterval(pollForFinalPost, 2000);
        }
      }
    } catch (error) {
      console.error("Error loading state:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);

    try {
      const response = await fetch(`/api/workflow/${blogPostId}/editorial`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setFinalPost({ content: data.finalContent });
        const seo = data.seoMetadata || {};
        const social = data.socialPosts || {};
        setSeoMetadata(seo);
        setSocialPosts(social);
        setInitialSeoMetadata(seo);
        setInitialSocialPosts(social);
      } else {
        const error = await response.json();
        alert(error.error?.message || "Failed to generate final post");
      }
    } catch (error) {
      console.error("Error generating final post:", error);
      alert("Failed to generate final post. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const response = await fetch(`/api/workflow/${blogPostId}/editorial`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seoMetadata,
          socialPosts,
        }),
      });

      if (response.ok) {
        // Update initial values to match current values after successful save
        setInitialSeoMetadata({ ...seoMetadata });
        setInitialSocialPosts({ ...socialPosts });
        setHasChanges(false);
        alert("Changes saved successfully!");
      } else {
        const error = await response.json();
        alert(error.error?.message || "Failed to save changes");
      }
    } catch (error) {
      console.error("Error saving:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);

    try {
      const response = await fetch(`/api/workflow/${blogPostId}/export`);

      if (response.ok) {
        const data = await response.json();
        
        // Create download
        const blob = new Blob([data.markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || "blog-post.md";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const error = await response.json();
        alert(error.error?.message || "Failed to export");
      }
    } catch (error) {
      console.error("Error exporting:", error);
      alert("Failed to export. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <WorkflowLoading
        messages={LOADING_MESSAGES.generic}
        title="Loading Final Post"
      />
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-2 text-foreground">Final Review & Export</h1>
          <p className="text-lg text-muted-foreground">
            Review your final blog post and export
          </p>
        </div>

        {!finalPost ? (
          <Card>
            <CardHeader>
              <CardTitle>{generating ? "Generating Final Post..." : "Generate Final Post"}</CardTitle>
              <CardDescription>
                {generating 
                  ? "Your final post is being generated with SEO optimization and social posts..."
                  : "Generate the final edited version with SEO and social posts"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {generating ? (
                <div className="flex flex-col items-center py-8">
                  <AILoading
                    loadingStates={LOADING_MESSAGES.editorial.map((text) => ({
                      text,
                      loading: true,
                    }))}
                  />
                </div>
              ) : (
                <Button onClick={handleGenerate} disabled={generating}>
                  Generate Final Post
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Final Blog Post</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPreviewFlipped(!isPreviewFlipped)}
                    aria-label={isPreviewFlipped ? "View markdown" : "View preview"}
                  >
                    {isPreviewFlipped ? (
                      <>
                        <Code className="mr-2 h-4 w-4" />
                        View/Edit Markdown
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        View Preview
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <MarkdownViewer 
                  content={finalPost.content || ""} 
                  maxHeight="600px" 
                  isFlipped={isPreviewFlipped}
                  onFlipChange={setIsPreviewFlipped}
                />
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>SEO Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <Input
                    value={seoMetadata.title || ""}
                    onChange={(e) => setSeoMetadata({ ...seoMetadata, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Meta Description</label>
                  <Textarea
                    value={seoMetadata.metaDescription || ""}
                    onChange={(e) => setSeoMetadata({ ...seoMetadata, metaDescription: e.target.value })}
                    className="min-h-[80px]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Social Posts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Twitter/X</label>
                  <Textarea
                    value={socialPosts.twitter || ""}
                    onChange={(e) => setSocialPosts({ ...socialPosts, twitter: e.target.value })}
                    className="min-h-[100px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">LinkedIn</label>
                  <Textarea
                    value={socialPosts.linkedin || ""}
                    onChange={(e) => setSocialPosts({ ...socialPosts, linkedin: e.target.value })}
                    className="min-h-[100px]"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => router.push(`/workflow/${blogPostId}/draft`)}
              >
                Back
              </Button>
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={saving || !hasChanges}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                onClick={handleExport}
                disabled={exporting}
                className="flex-1"
                size="lg"
              >
                {exporting ? "Exporting..." : "Download Markdown"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

