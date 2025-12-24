"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Loader from "@/components/kokonutui/loader";

export default function WorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const blogPostId = params.blogPostId as string;
  
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<string>("voice_tone");

  useEffect(() => {
    loadState();
  }, [blogPostId]);

  const loadState = async () => {
    try {
      const response = await fetch(`/api/workflow/${blogPostId}/state`);
      if (response.ok) {
        const data = await response.json();
        setState(data);
        const step = data.status?.replace("_pending", "") || "voice_tone";
        setCurrentStep(step);
        
        // Redirect to appropriate step page
        if (step === "voice_tone") {
          router.push(`/workflow/${blogPostId}/voice-tone`);
        } else if (step === "thesis") {
          router.push(`/workflow/${blogPostId}/thesis`);
        } else if (step === "research") {
          router.push(`/workflow/${blogPostId}/research`);
        } else if (step === "draft") {
          router.push(`/workflow/${blogPostId}/draft`);
        } else if (step === "editorial" || step === "completed") {
          router.push(`/workflow/${blogPostId}/final`);
        }
      }
    } catch (error) {
      console.error("Error loading state:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader 
          title="Loading Workflow"
          description="Checking your progress..."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-8">
            <p>Redirecting to current step...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

