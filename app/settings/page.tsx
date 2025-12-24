"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const PROVIDERS = [
  { id: "openai", label: "OpenAI", placeholder: "sk-..." },
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
];

export default function SettingsPage() {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const response = await fetch("/api/api-keys");
      if (response.ok) {
        const data = await response.json();
        const keysMap: Record<string, string> = {};
        data.keys.forEach((key: any) => {
          keysMap[key.provider] = "***"; // Don't show actual keys
        });
        setKeys(keysMap);
      }
    } catch (error) {
      console.error("Error loading keys:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (provider: string, apiKey: string) => {
    setSaving({ ...saving, [provider]: true });

    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });

      if (response.ok) {
        setKeys({ ...keys, [provider]: "***" });
        alert("API key saved successfully");
      } else {
        const error = await response.json();
        alert(error.error?.message || "Failed to save API key");
      }
    } catch (error) {
      console.error("Error saving key:", error);
      alert("Failed to save API key. Please try again.");
    } finally {
      setSaving({ ...saving, [provider]: false });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-2 text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            Manage your API keys for LLM providers
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Configure your API keys for OpenAI or Anthropic. These are encrypted and stored securely.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {PROVIDERS.map((provider) => (
              <div key={provider.id} className="space-y-2">
                <label className="block text-sm font-medium">
                  {provider.label} API Key
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder={provider.placeholder}
                    value={keys[provider.id] || ""}
                    onChange={(e) => {
                      if (keys[provider.id] === "***") {
                        // Don't allow editing masked keys
                        return;
                      }
                      setKeys({ ...keys, [provider.id]: e.target.value });
                    }}
                    disabled={keys[provider.id] === "***"}
                    className="flex-1"
                  />
                  {keys[provider.id] === "***" ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setKeys({ ...keys, [provider.id]: "" });
                      }}
                    >
                      Change
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSave(provider.id, keys[provider.id] || "")}
                      disabled={!keys[provider.id] || saving[provider.id]}
                    >
                      {saving[provider.id] ? "Saving..." : "Save"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

