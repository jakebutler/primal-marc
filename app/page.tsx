"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShapeHero } from "@/components/kokonutui/shape-hero";
import { PrimalMarcIcon } from "@/components/icons/PrimalMarcIcon";
import dynamic from "next/dynamic";

const Loader = dynamic(() => import("@/components/kokonutui/loader").then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    </div>
  ),
});

const BLOG_TYPES = [
  { id: "academic", label: "Academic/Research", description: "Technical, in-depth articles" },
  { id: "argumentative", label: "Argumentative", description: "Opinion-driven posts" },
  { id: "lessons", label: "Lessons from Experience", description: "Reflective posts" },
  { id: "metaphor", label: "Experiential Metaphor", description: "Concept illustration" },
  { id: "systems", label: "Systems/Workflow Deep Dive", description: "Process breakdowns" },
];

export default function HomePage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [idea, setIdea] = useState("");
  const [blogType, setBlogType] = useState<string>("");
  const [loading, setLoading] = useState(false);
  
  // Landing page state
  const [email, setEmail] = useState("");
  const [requestStatus, setRequestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader 
          title="Primal Marc"
          description="Preparing your workspace..."
        />
      </div>
    );
  }

  // Landing page for unauthenticated users
  if (!isSignedIn) {
    const handleRequestAccess = async (e: React.FormEvent) => {
      e.preventDefault();
      setRequestStatus("loading");
      setErrorMessage("");

      try {
        const response = await fetch("/api/request-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!response.ok) {
          setRequestStatus("error");
          setErrorMessage(data.error?.message || "Failed to submit request. Please try again.");
          return;
        }

        setRequestStatus("success");
        setEmail("");
      } catch (error: any) {
        setRequestStatus("error");
        setErrorMessage("Failed to submit request. Please try again.");
      }
    };

    return (
      <ShapeHero className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-3xl w-full">
          <div className="text-center mb-12">
            {/* Icon */}
            <div className="flex justify-center mb-8">
              <PrimalMarcIcon size={120} className="text-primary" />
            </div>
            
            {/* Headline */}
            <h1 className="text-6xl md:text-7xl font-serif font-bold mb-6 text-foreground">
              Unleash Your Ideas
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              Transform raw thoughts into polished prose
            </p>
            
            {/* Value props */}
            <div className="flex flex-wrap justify-center gap-4 md:gap-8 text-sm md:text-base text-muted-foreground mb-12">
              <span className="font-medium">From spark to story in minutes</span>
              <span className="text-muted-foreground/50">•</span>
              <span className="font-medium">AI that writes like you think</span>
              <span className="text-muted-foreground/50">•</span>
              <span className="font-medium">Professional polish, primal energy</span>
            </div>
          </div>

          <Card className="max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Request Access</CardTitle>
              <CardDescription>
                Join our beta to start creating high-quality blog posts powered by AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requestStatus === "success" ? (
                <div className="text-center py-6">
                  <div className="mb-4">
                    <svg
                      className="mx-auto h-12 w-12 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Request Received!</h3>
                  <p className="text-muted-foreground mb-4">
                    We&apos;ll review your request and send an invitation if approved.
                  </p>
                  <Button
                    onClick={() => {
                      setRequestStatus("idle");
                      setEmail("");
                    }}
                    variant="outline"
                  >
                    Submit Another Request
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleRequestAccess} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                      Email Address
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      disabled={requestStatus === "loading"}
                      className="w-full"
                    />
                  </div>

                  {requestStatus === "error" && errorMessage && (
                    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                      {errorMessage}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={requestStatus === "loading" || !email.trim()}
                    className="w-full"
                  >
                    {requestStatus === "loading" ? "Submitting..." : "Request Access"}
                  </Button>

                  <div className="text-center text-sm text-muted-foreground pt-4 border-t">
                    Already have an account?{" "}
                    <a
                      href="/sign-in"
                      className="text-primary hover:underline font-medium"
                    >
                      Sign in
                    </a>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </ShapeHero>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!idea.trim() || !blogType) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/workflow/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, blogType }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
        throw new Error(errorData.error?.message || "Failed to initialize workflow");
      }

      const data = await response.json();
      router.push(`/workflow/${data.blogPostId}/voice-tone`);
    } catch (error: any) {
      console.error("Error:", error);
      alert(`Failed to start workflow: ${error.message || "Please try again."}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-serif font-bold mb-4 text-foreground">
            What will you create?
          </h1>
          <p className="text-lg text-muted-foreground">
            Transform your ideas into professional blog posts with AI assistance
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Start Your Blog Post</CardTitle>
            <CardDescription>
              Share your idea and select a blog type to begin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="idea" className="block text-sm font-medium mb-2">
                  What's your blog post idea?
                </label>
                <textarea
                  id="idea"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  className="w-full min-h-[120px] p-3 border rounded-md resize-y"
                  placeholder="Describe your blog post idea..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Select blog type:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {BLOG_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setBlogType(type.id)}
                      className={`p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                        blogType === type.id
                          ? "border-secondary bg-secondary/10 shadow-md scale-[1.02]"
                          : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="font-medium">{type.label}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {type.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !idea.trim() || !blogType}
                className="w-full"
              >
                {loading ? "Starting..." : "Start Writing"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

