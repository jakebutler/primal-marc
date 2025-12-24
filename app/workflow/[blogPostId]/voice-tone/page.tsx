"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { WorkflowLoading } from "@/components/workflow/workflow-loading";
import { LOADING_MESSAGES } from "@/lib/loading-messages";

export default function VoiceTonePage() {
  const params = useParams();
  const router = useRouter();
  const blogPostId = params.blogPostId as string;
  
  const [options, setOptions] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadOptions();
  }, [blogPostId]);

  const loadOptions = async () => {
    try {
      const response = await fetch(`/api/workflow/${blogPostId}/voice-tone`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        // Ensure options is always an array
        const optionsArray = Array.isArray(data.options) ? data.options : [];
        setOptions(optionsArray);
        
        if (optionsArray.length === 0) {
          console.error("No options received:", data);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
        console.error("Error response:", errorData);
        alert(`Failed to load options: ${errorData.error?.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error loading options:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selected) return;

    setSubmitting(true);

    try {
      const selectedOption = options.find(opt => opt.id === selected);
      
      const response = await fetch(`/api/workflow/${blogPostId}/voice-tone`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedOptionId: selected,
          selectedOptionName: selectedOption.name,
          styleGuidelines: selectedOption.style,
        }),
      });

      if (response.ok) {
        router.push(`/workflow/${blogPostId}/thesis`);
      } else {
        const error = await response.json();
        alert(error.error?.message || "Failed to save selection");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to save selection. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <WorkflowLoading
        messages={LOADING_MESSAGES.voiceTone}
        title="Crafting Your Voice"
        subtitle="Analyzing your blog type to create personalized options"
      />
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-2 text-foreground">Choose Your Voice & Tone</h1>
          <p className="text-lg text-muted-foreground">
            Select the voice that best matches your brand
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Voice & Tone Options</CardTitle>
            <CardDescription>
              We've generated 3 options tailored to your blog type
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {options.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No voice/tone options available. Please try again.</p>
                <Button onClick={loadOptions} className="mt-4">Retry</Button>
              </div>
            ) : (
              <RadioGroup value={selected} onValueChange={setSelected}>
                {options.map((option: any) => (
                <div
                  key={option.id}
                  className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                    selected === option.id
                      ? "border-secondary bg-secondary/10 shadow-md"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                  }`}
                  onClick={() => setSelected(option.id)}
                >
                  <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                  <label htmlFor={option.id} className="flex-1 cursor-pointer">
                    <div className="font-medium text-lg mb-1">{option.name}</div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {option.description}
                    </div>
                    <div className="text-xs space-y-1">
                      <div><strong>Style:</strong> {option.style.writingStyle}</div>
                      <div><strong>Formality:</strong> {option.style.formality}</div>
                      <div><strong>Tone:</strong> {option.style.emotionalPosture}</div>
                    </div>
                  </label>
                </div>
                ))}
              </RadioGroup>
            )}

            <div className="flex gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push(`/workflow/${blogPostId}`)}
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selected || submitting}
                className="flex-1"
              >
                {submitting ? "Saving..." : "Continue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

