"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowLoading } from "@/components/workflow/workflow-loading";
import dynamic from "next/dynamic";
import { LOADING_MESSAGES } from "@/lib/loading-messages";

const AILoading = dynamic(() => import("@/components/kokonutui/ai-loading").then(mod => mod.default), {
  ssr: false,
});

// Check if research is stale by comparing timestamps
function isResearchStale(thesisUpdatedAt: string | null, researchUpdatedAt: string | null): boolean {
  if (!researchUpdatedAt) return true; // No research = stale
  if (!thesisUpdatedAt) return false; // No thesis timestamp = can't determine, assume fresh
  
  return new Date(thesisUpdatedAt) > new Date(researchUpdatedAt);
}

export default function ResearchPage() {
  const params = useParams();
  const router = useRouter();
  const blogPostId = params.blogPostId as string;
  
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [waitingForBackground, setWaitingForBackground] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftGenerating, setDraftGenerating] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const hasStartedResearch = useRef(false);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const draftAbortController = useRef<AbortController | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  // Auto-start research when page loads if no sources exist
  useEffect(() => {
    loadState();
  }, [blogPostId]);

  // Poll for background research completion
  const pollForResearch = useCallback(async () => {
    console.log("[Research] Polling for background research...");
    setWaitingForBackground(true);
    
    let pollCount = 0;
    const maxPolls = 60; // Poll for up to 2 minutes (2s interval)
    
    pollingInterval.current = setInterval(async () => {
      pollCount++;
      console.log(`[Research] Poll attempt ${pollCount}/${maxPolls}`);
      
      try {
        const response = await fetch(`/api/workflow/${blogPostId}/state`);
        if (response.ok) {
          const data = await response.json();
          
          if (data.researchSources?.sources && data.researchSources.sources.length > 0) {
            // Check if research is still fresh
            const stale = isResearchStale(
              data.thesisOutline?.updatedAt,
              data.researchSources?.updatedAt
            );
            
            if (!stale) {
              console.log("[Research] Background research completed!");
              if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
                pollingInterval.current = null;
              }
              setSources(data.researchSources.sources);
              setWaitingForBackground(false);
              setLoading(false);
              
              // Start optimistic draft generation
              startOptimisticDraftGeneration();
              
              // Check if draft already exists
              if (data.draft?.content) {
                setDraftReady(true);
              }
              return;
            }
          }
        }
      } catch (error) {
        console.error("[Research] Polling error:", error);
      }
      
      // If we've exceeded max polls, stop polling and trigger fresh research
      if (pollCount >= maxPolls) {
        console.log("[Research] Polling timeout, triggering fresh research");
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
        setWaitingForBackground(false);
        handleResearch();
      }
    }, 2000);
  }, [blogPostId]);

  const startOptimisticDraftGeneration = useCallback(async () => {
    // Cancel any previous draft generation
    if (draftAbortController.current) {
      draftAbortController.current.abort();
    }
    
    draftAbortController.current = new AbortController();
    setDraftGenerating(true);
    setDraftReady(false);
    
    try {
      const response = await fetch(`/api/workflow/${blogPostId}/draft`, {
        method: "POST",
        signal: draftAbortController.current.signal,
      });

      if (response.ok) {
        setDraftReady(true);
        console.log("Draft generated optimistically");
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Error generating draft optimistically:", error);
      }
    } finally {
      setDraftGenerating(false);
    }
  }, [blogPostId]);

  const loadState = async () => {
    try {
      const response = await fetch(`/api/workflow/${blogPostId}/state`);
      if (response.ok) {
        const data = await response.json();
        
        const hasSources = data.researchSources?.sources && data.researchSources.sources.length > 0;
        const stale = isResearchStale(
          data.thesisOutline?.updatedAt,
          data.researchSources?.updatedAt
        );
        
        console.log(`[Research] State loaded - hasSources: ${hasSources}, stale: ${stale}`);
        
        if (hasSources && !stale) {
          // Research exists and is fresh - show immediately!
          console.log("[Research] Fresh research found, displaying immediately");
          setSources(data.researchSources.sources);
          setLoading(false);
          
          // If we already have a draft, mark it as ready
          if (data.draft?.content) {
            setDraftReady(true);
          } else {
            // Start optimistic draft generation
            startOptimisticDraftGeneration();
          }
        } else if (!hasStartedResearch.current) {
          hasStartedResearch.current = true;
          
          if (hasSources && stale) {
            // Research exists but is stale - trigger fresh research
            console.log("[Research] Stale research found, triggering fresh research");
            setLoading(false);
            handleResearch();
          } else {
            // No sources yet - could be background research in progress
            // Poll for a bit before triggering our own research
            console.log("[Research] No sources yet, polling for background research");
            setLoading(false);
            pollForResearch();
          }
          return;
        }
      }
    } catch (error) {
      console.error("Error loading state:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResearch = async () => {
    // Stop any background polling
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
    setWaitingForBackground(false);
    setResearching(true);

    try {
      const response = await fetch(`/api/workflow/${blogPostId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText || "Unknown error" } };
        }
        throw new Error(errorData.error?.message || "Failed to research");
      }

      const responseText = await response.text();
      if (!responseText) {
        throw new Error("Empty response from server");
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON parse error:", parseError, "Response:", responseText);
        throw new Error("Invalid response from server");
      }

      // Check for error in response
      if (data.error) {
        console.error("Research API returned error:", data.error);
        alert(`Research error: ${data.error.message || "Unknown error"}`);
        setSources([]);
        return; // Don't set sources if there's an error
      }

      // Check for warning about empty sources
      if (data.warning) {
        console.warn("Research API warning:", data.warning);
        alert(data.warning);
      }

      // Ensure sources is an array
      const sourcesArray = Array.isArray(data.sources) ? data.sources : [];
      console.log("Research API returned sources:", sourcesArray.length);
      
      if (sourcesArray.length === 0 && !data.error && !data.warning) {
        console.warn("Research API returned empty sources array without warning");
        alert("No research sources were found. This might be due to missing API keys (PERPLEXITY_API_KEY or EXA_API_KEY) or the research API failing. Check the server logs for details.");
      }
      
      setSources(sourcesArray);
      
      // Start optimistic draft generation once research is complete
      if (sourcesArray.length > 0) {
        startOptimisticDraftGeneration();
      }
    } catch (error: any) {
      console.error("Error researching:", error);
      alert(`Failed to research: ${error.message || "Please try again."}`);
    } finally {
      setResearching(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      const response = await fetch(`/api/workflow/${blogPostId}/research`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestAdditionalResearch: false,
        }),
      });

      if (response.ok) {
        router.push(`/workflow/${blogPostId}/draft`);
      } else {
        const error = await response.json();
        alert(error.error?.message || "Failed to continue");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to continue. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <WorkflowLoading
        messages={LOADING_MESSAGES.generic}
        title="Loading Research"
      />
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-2 text-foreground">Research Sources</h1>
          <p className="text-lg text-muted-foreground">
            {researching 
              ? "Searching for sources..."
              : waitingForBackground
              ? "Background research in progress..."
              : "Review the sources found for your blog post"}
          </p>
        </div>

        {/* Draft generation status */}
        {(draftGenerating || draftReady) && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {draftGenerating ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    <span className="text-blue-700">
                      {LOADING_MESSAGES.backgroundDraft[0]}
                    </span>
                  </>
                ) : draftReady ? (
                  <>
                    <div className="h-4 w-4 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                    <span className="text-green-700">Draft ready! Continue when you&apos;re satisfied with the sources.</span>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Research Sources</CardTitle>
            <CardDescription>
              {researching 
                ? "Searching for relevant sources..."
                : sources.length > 0 
                  ? `Found ${sources.length} sources for your blog post`
                  : "No sources found yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(researching || waitingForBackground) && sources.length === 0 ? (
              <div className="flex flex-col items-center py-8">
                <AILoading
                  loadingStates={LOADING_MESSAGES.research.map((text) => ({
                    text,
                    loading: true,
                  }))}
                />
                {waitingForBackground && !researching && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Research was started in the background. Results should appear shortly...
                  </p>
                )}
              </div>
            ) : sources.length === 0 ? (
              <Button onClick={handleResearch} disabled={researching}>
                {researching ? "Researching..." : "Find Research Sources"}
              </Button>
            ) : (
              <>
                <div className="space-y-3">
                  {sources.map((source, index) => (
                    <div key={source.id || index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium">{source.title}</div>
                          <a 
                            href={source.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-secondary hover:underline"
                          >
                            {source.url}
                          </a>
                        </div>
                        <div className="text-sm">
                          <div className="font-medium">Quality: {source.qualityScore}/5</div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {source.qualityRationale}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/workflow/${blogPostId}/thesis`)}
                  >
                    Back
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Cancel any pending draft generation when requesting new research
                      if (draftAbortController.current) {
                        draftAbortController.current.abort();
                      }
                      setDraftReady(false);
                      handleResearch();
                    }}
                    disabled={researching}
                  >
                    {researching ? "Researching..." : "Request Additional Research"}
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || draftGenerating}
                    className="flex-1"
                  >
                    {submitting ? "Saving..." : draftReady ? "Continue to Draft ✓" : draftGenerating ? "Preparing Draft..." : "Continue to Draft"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

