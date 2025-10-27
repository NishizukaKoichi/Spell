"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Key, Trash2, Copy, Plus, Eye, EyeOff } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export function ApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyVisible, setNewKeyVisible] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await fetch("/api/keys");
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.apiKeys);
      }
    } catch (error) {
      console.error("Failed to fetch API keys:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      alert("Please enter a name for the API key");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        // Show the full key to the user (only shown once)
        setNewKeyVisible(data.apiKey.key);
        setNewKeyName("");
        // Refresh the list
        fetchApiKeys();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create API key");
      }
    } catch (error) {
      console.error("Failed to create API key:", error);
      alert("Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) {
      return;
    }

    try {
      const response = await fetch(`/api/keys/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchApiKeys();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete API key");
      }
    } catch (error) {
      console.error("Failed to delete API key:", error);
      alert("Failed to delete API key");
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (isLoading) {
    return <div className="text-white/60">Loading API keys...</div>;
  }

  return (
    <div className="space-y-6">
      {/* New Key Dialog */}
      {newKeyVisible && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardHeader>
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Key className="h-5 w-5 text-yellow-500" />
              Your New API Key
            </h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-white/60">
              Make sure to copy your API key now. You won&apos;t be able to see
              it again!
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/50 px-4 py-2 rounded text-sm font-mono">
                {newKeyVisible}
              </code>
              <Button
                size="sm"
                onClick={() => handleCopyKey(newKeyVisible)}
                className="shrink-0"
              >
                <Copy className="h-4 w-4" />
                {copiedKey === newKeyVisible ? "Copied!" : "Copy"}
              </Button>
            </div>
            <Button
              onClick={() => setNewKeyVisible(null)}
              variant="outline"
              className="w-full"
            >
              I&apos;ve saved my key
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create New Key */}
      <Card className="border-white/10">
        <CardHeader>
          <h3 className="text-xl font-semibold">Create New API Key</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="API Key Name (e.g., Production, Development)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded px-4 py-2 text-white placeholder:text-white/40"
              disabled={isCreating}
            />
            <Button
              onClick={handleCreateKey}
              disabled={isCreating || !newKeyName.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Key
            </Button>
          </div>
          <p className="text-sm text-white/60">
            Maximum of 5 active API keys allowed per account.
          </p>
        </CardContent>
      </Card>

      {/* API Keys List */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Your API Keys</h3>
        {apiKeys.length === 0 ? (
          <Card className="border-white/10">
            <CardContent className="py-8 text-center text-white/60">
              No API keys yet. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((key) => (
              <Card key={key.id} className="border-white/10">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Key className="h-4 w-4 text-purple-500" />
                        <div>
                          <h4 className="font-semibold">{key.name}</h4>
                          <code className="text-xs text-white/60 font-mono">
                            {key.key}
                          </code>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-white/40">
                        Created:{" "}
                        {new Date(key.createdAt).toLocaleDateString()}
                        {key.lastUsedAt && (
                          <span className="ml-4">
                            Last used:{" "}
                            {new Date(key.lastUsedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteKey(key.id)}
                      className="text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <Card className="border-white/10">
        <CardHeader>
          <h3 className="text-xl font-semibold">Using the API</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Endpoint</h4>
            <code className="block bg-black/50 px-4 py-2 rounded text-sm font-mono">
              POST https://magicspell.io/api/v1/cast
            </code>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Headers</h4>
            <code className="block bg-black/50 px-4 py-2 rounded text-sm font-mono whitespace-pre">
              {`Authorization: Bearer YOUR_API_KEY\nContent-Type: application/json`}
            </code>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Request Body</h4>
            <code className="block bg-black/50 px-4 py-2 rounded text-sm font-mono whitespace-pre">
              {`{
  "spell_key": "image-resize",
  "input": {
    "width": 800,
    "height": 600
  }
}`}
            </code>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Example (curl)</h4>
            <code className="block bg-black/50 px-4 py-2 rounded text-xs font-mono whitespace-pre overflow-x-auto">
              {`curl -X POST https://magicspell.io/api/v1/cast \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"spell_key": "image-resize", "input": {}}'`}
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
