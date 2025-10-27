"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NewSpellPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    key: "",
    description: "",
    longDescription: "",
    category: "",
    priceModel: "metered",
    priceAmount: "",
    executionMode: "workflow",
  });

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleKeyChange = (name: string) => {
    const key = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setFormData({ ...formData, key });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name || !formData.description || !formData.priceAmount) {
      setError("Please fill in all required fields");
      return;
    }

    if (tags.length === 0) {
      setError("Please add at least one tag");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/spells/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          priceAmount: parseFloat(formData.priceAmount) * 100, // Convert to cents
          tags,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create spell");
      }

      const { spell } = await response.json();
      router.push(`/spells/${spell.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create spell");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-8">
        <div>
          <Link
            href="/my-spells"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Spells
          </Link>
          <h1 className="text-4xl font-bold mb-2">Create New Spell</h1>
          <p className="text-white/60">
            Publish your workflow to the marketplace
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="border-white/10">
            <CardHeader>
              <h2 className="text-xl font-semibold">Basic Information</h2>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Spell Name <span className="text-red-400">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    handleKeyChange(e.target.value);
                  }}
                  placeholder="Image Resizer"
                  className="bg-white/5 border-white/10"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Spell Key</label>
                <Input
                  value={formData.key}
                  onChange={(e) =>
                    setFormData({ ...formData, key: e.target.value })
                  }
                  placeholder="image-resizer"
                  className="bg-white/5 border-white/10 font-mono"
                  readOnly
                />
                <p className="text-xs text-white/40">
                  Auto-generated from spell name
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Short Description <span className="text-red-400">*</span>
                </label>
                <Input
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Brief description of what your spell does"
                  className="bg-white/5 border-white/10"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Long Description</label>
                <textarea
                  value={formData.longDescription}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      longDescription: e.target.value,
                    })
                  }
                  placeholder="Detailed description, usage examples, etc."
                  className="w-full min-h-[120px] rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Input
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  placeholder="Image Processing"
                  className="bg-white/5 border-white/10"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Tags <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add a tag"
                    className="bg-white/5 border-white/10"
                  />
                  <Button
                    type="button"
                    onClick={handleAddTag}
                    variant="outline"
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="gap-2 cursor-pointer"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag}
                        <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Separator className="bg-white/10" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Price Model <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.priceModel}
                    onChange={(e) =>
                      setFormData({ ...formData, priceModel: e.target.value })
                    }
                    className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  >
                    <option value="metered">Metered (per use)</option>
                    <option value="one_time">One-time purchase</option>
                    <option value="subscription">Subscription</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Price (USD) <span className="text-red-400">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.priceAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, priceAmount: e.target.value })
                    }
                    placeholder="9.99"
                    className="bg-white/5 border-white/10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Execution Mode</label>
                <select
                  value={formData.executionMode}
                  onChange={(e) =>
                    setFormData({ ...formData, executionMode: e.target.value })
                  }
                  className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm"
                >
                  <option value="workflow">Workflow (GitHub Actions)</option>
                  <option value="service" disabled>
                    Service (Coming Soon)
                  </option>
                  <option value="clone" disabled>
                    Clone (Coming Soon)
                  </option>
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {loading ? "Creating..." : "Create Spell"}
                </Button>
                <Link href="/my-spells" className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  );
}
