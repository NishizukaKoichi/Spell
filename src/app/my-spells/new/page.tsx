'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, X, Eye, Code2, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const CATEGORIES = [
  'Image Processing',
  'Video Processing',
  'Audio Processing',
  'Document Processing',
  'AI & Machine Learning',
  'Data Analysis',
  'Automation',
  'API Integration',
  'Web Scraping',
  'Other',
];

const EXAMPLE_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    width: {
      type: 'number',
      description: 'Target width in pixels',
      minimum: 1,
    },
    height: {
      type: 'number',
      description: 'Target height in pixels',
      minimum: 1,
    },
    format: {
      type: 'string',
      description: 'Output format',
      enum: ['jpg', 'png', 'webp'],
    },
  },
  required: ['width', 'height'],
};

const EXAMPLE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    url: {
      type: 'string',
      description: 'URL to the processed image',
    },
    size: {
      type: 'number',
      description: 'File size in bytes',
    },
  },
  required: ['url'],
};

export default function NewSpellPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    key: '',
    description: '',
    longDescription: '',
    category: '',
    priceModel: 'metered',
    priceAmountCents: '',
    executionMode: 'workflow',
    webhookUrl: '',
  });

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [inputSchema, setInputSchema] = useState(JSON.stringify(EXAMPLE_INPUT_SCHEMA, null, 2));
  const [outputSchema, setOutputSchema] = useState(JSON.stringify(EXAMPLE_OUTPUT_SCHEMA, null, 2));

  const [inputSchemaError, setInputSchemaError] = useState('');
  const [outputSchemaError, setOutputSchemaError] = useState('');

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleKeyChange = (name: string) => {
    const key = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setFormData({ ...formData, key });
  };

  const validateJsonSchema = (schema: string, type: 'input' | 'output'): boolean => {
    try {
      const parsed = JSON.parse(schema);

      // Basic JSON Schema validation
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Schema must be an object');
      }

      if (type === 'input') {
        setInputSchemaError('');
      } else {
        setOutputSchemaError('');
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid JSON';
      if (type === 'input') {
        setInputSchemaError(errorMessage);
      } else {
        setOutputSchemaError(errorMessage);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.description || !formData.priceAmountCents) {
      setError('Please fill in all required fields');
      return;
    }

    if (tags.length === 0) {
      setError('Please add at least one tag');
      return;
    }

    if (!formData.category) {
      setError('Please select a category');
      return;
    }

    // Validate schemas
    const inputValid = validateJsonSchema(inputSchema, 'input');
    const outputValid = validateJsonSchema(outputSchema, 'output');

    if (!inputValid || !outputValid) {
      setError('Please fix JSON schema errors before submitting');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/spells/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          priceAmountCents: parseFloat(formData.priceAmountCents) * 100,
          tags,
          inputSchema: JSON.parse(inputSchema),
          outputSchema: JSON.parse(outputSchema),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create spell');
      }

      const { spell } = await response.json();
      router.push(`/spells/${spell.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create spell');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-8">
        <div>
          <Link
            href="/my-spells"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Spells
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Create New Spell</h1>
              <p className="text-white/60">Publish your workflow to the marketplace</p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              {showPreview ? 'Hide' : 'Show'} Preview
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Basic Information */}
            <Card className="border-white/10">
              <CardHeader>
                <h2 className="text-xl font-semibold">Basic Information</h2>
              </CardHeader>
              <CardContent className="space-y-6">
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
                    className="bg-white text-black/5 border-white/10"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Spell Key</label>
                  <Input
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    placeholder="image-resizer"
                    className="bg-white text-black/5 border-white/10 font-mono"
                    readOnly
                  />
                  <p className="text-xs text-white/40">Auto-generated from spell name</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Short Description <span className="text-red-400">*</span>
                  </label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of what your spell does"
                    className="bg-white text-black/5 border-white/10"
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
                    className="w-full min-h-[120px] rounded-md bg-white text-black/5 border border-white/10 px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Category <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-md bg-white text-black/5 border border-white/10 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select a category</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
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
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="Add a tag"
                      className="bg-white text-black/5 border-white/10"
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
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card className="border-white/10">
              <CardHeader>
                <h2 className="text-xl font-semibold">Pricing</h2>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Price Model <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.priceModel}
                    onChange={(e) => setFormData({ ...formData, priceModel: e.target.value })}
                    className="w-full rounded-md bg-white text-black/5 border border-white/10 px-3 py-2 text-sm"
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
                    value={formData.priceAmountCents}
                    onChange={(e) => setFormData({ ...formData, priceAmountCents: e.target.value })}
                    placeholder="9.99"
                    className="bg-white text-black/5 border-white/10"
                    required
                  />
                </div>
              </CardContent>
            </Card>

            {/* Execution Mode */}
            <Card className="border-white/10">
              <CardHeader>
                <h2 className="text-xl font-semibold">Execution</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Execution Mode</label>
                  <select
                    value={formData.executionMode}
                    onChange={(e) => setFormData({ ...formData, executionMode: e.target.value })}
                    className="w-full rounded-md bg-white text-black/5 border border-white/10 px-3 py-2 text-sm"
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">Webhook URL (Optional)</label>
                  <Input
                    type="url"
                    value={formData.webhookUrl}
                    onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                    placeholder="https://your-api.com/webhook"
                    className="bg-white text-black/5 border-white/10"
                  />
                  <p className="text-xs text-white/60">
                    Receive POST notifications when spell execution completes
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* JSON Schemas */}
            <Card className="border-white/10">
              <CardHeader>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Code2 className="h-5 w-5" />
                  Input/Output Schemas
                </h2>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="input">
                  <TabsList>
                    <TabsTrigger value="input">
                      Input Schema
                      {!inputSchemaError && <Check className="h-3 w-3 ml-2 text-green-500" />}
                      {inputSchemaError && <AlertCircle className="h-3 w-3 ml-2 text-red-500" />}
                    </TabsTrigger>
                    <TabsTrigger value="output">
                      Output Schema
                      {!outputSchemaError && <Check className="h-3 w-3 ml-2 text-green-500" />}
                      {outputSchemaError && <AlertCircle className="h-3 w-3 ml-2 text-red-500" />}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="input" className="space-y-2">
                    <textarea
                      value={inputSchema}
                      onChange={(e) => {
                        setInputSchema(e.target.value);
                        validateJsonSchema(e.target.value, 'input');
                      }}
                      className="w-full min-h-[300px] rounded-md bg-black/50 border border-white/10 px-3 py-2 text-xs font-mono"
                    />
                    {inputSchemaError && <p className="text-xs text-red-400">{inputSchemaError}</p>}
                    <p className="text-xs text-white/40">
                      Define the expected input format using JSON Schema
                    </p>
                  </TabsContent>

                  <TabsContent value="output" className="space-y-2">
                    <textarea
                      value={outputSchema}
                      onChange={(e) => {
                        setOutputSchema(e.target.value);
                        validateJsonSchema(e.target.value, 'output');
                      }}
                      className="w-full min-h-[300px] rounded-md bg-black/50 border border-white/10 px-3 py-2 text-xs font-mono"
                    />
                    {outputSchemaError && (
                      <p className="text-xs text-red-400">{outputSchemaError}</p>
                    )}
                    <p className="text-xs text-white/40">
                      Define the output format using JSON Schema
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-white hover:bg-white text-black/90"
              >
                {loading ? 'Creating...' : 'Create Spell'}
              </Button>
              <Link href="/my-spells" className="flex-1">
                <Button type="button" variant="outline" className="w-full" disabled={loading}>
                  Cancel
                </Button>
              </Link>
            </div>
          </form>

          {/* Preview Panel */}
          {showPreview && (
            <div className="lg:col-span-1">
              <Card className="border-white/10 sticky top-8">
                <CardHeader>
                  <h2 className="text-xl font-semibold">Preview</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.name && (
                    <div>
                      <h3 className="text-2xl font-bold">{formData.name}</h3>
                      {formData.category && (
                        <Badge variant="outline" className="mt-2">
                          {formData.category}
                        </Badge>
                      )}
                    </div>
                  )}

                  {formData.description && (
                    <p className="text-sm text-white/80">{formData.description}</p>
                  )}

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Separator className="bg-white text-black/10" />

                  {formData.priceAmountCents && (
                    <div>
                      <p className="text-sm text-white/60">Price</p>
                      <p className="text-2xl font-bold">
                        ${formData.priceAmountCents}
                        {formData.priceModel === 'metered' && (
                          <span className="text-sm font-normal text-white/60"> per use</span>
                        )}
                      </p>
                    </div>
                  )}

                  {formData.executionMode && (
                    <div>
                      <p className="text-sm text-white/60">Execution</p>
                      <p className="text-sm">{formData.executionMode}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
