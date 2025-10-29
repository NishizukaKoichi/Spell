'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CastProgress } from '@/components/cast-progress';
import { ReviewForm } from '@/components/review-form';
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  AlertCircle,
  Zap,
  Calendar,
  DollarSign,
  Wifi,
  WifiOff,
} from 'lucide-react';
import Link from 'next/link';
import { toast, Toaster } from 'sonner';

interface Cast {
  id: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  duration: number | null;
  errorMessage: string | null;
  artifactUrl: string | null;
  costCents: number;
  createdAt: string;
  inputHash: string | null;
  spell: {
    id: string;
    name: string;
    description: string;
    version: string | null;
    executionMode: string | null;
    category: string | null;
    tags: string[];
  };
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-6 w-6 text-green-500" />;
    case 'failed':
      return <XCircle className="h-6 w-6 text-red-500" />;
    case 'running':
      return <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />;
    default:
      return <Clock className="h-6 w-6 text-yellow-500" />;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-green-500 bg-green-500/10 border-green-500/20';
    case 'failed':
      return 'text-red-500 bg-red-500/10 border-red-500/20';
    case 'running':
      return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    default:
      return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
  }
}

function formatDuration(ms: number | null): string {
  if (!ms) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function CastDetailClient({ initialCast }: { initialCast: Cast }) {
  const [cast, setCast] = useState<Cast>(initialCast);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    // Only connect to SSE if cast is not in terminal state
    if (cast.status === 'completed' || cast.status === 'failed') {
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connect = () => {
      eventSource = new EventSource(`/api/casts/${cast.id}/stream`);

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.error) {
            console.error('SSE error:', data.error);
            return;
          }

          const previousStatus = cast.status;

          // Update cast state with new data
          setCast((prev) => ({
            ...prev,
            status: data.status,
            startedAt: data.startedAt,
            finishedAt: data.finishedAt,
            duration: data.duration,
            errorMessage: data.errorMessage,
            artifactUrl: data.artifactUrl,
            costCents: data.costCents,
          }));

          setLastUpdate(new Date());

          // Show toast notifications for status changes
          if (previousStatus !== data.status) {
            if (data.status === 'running') {
              toast.info('Execution started', {
                description: 'Your spell is now running',
              });
            } else if (data.status === 'completed') {
              toast.success('Execution completed', {
                description: 'Your spell has finished successfully',
              });
            } else if (data.status === 'failed') {
              toast.error('Execution failed', {
                description: data.errorMessage || 'An error occurred',
              });
            }
          }

          // Close connection if cast reached terminal state
          if (data.status === 'completed' || data.status === 'failed') {
            eventSource?.close();
            setIsConnected(false);
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setIsConnected(false);
        eventSource?.close();

        // Show reconnection toast
        toast.warning('Connection lost', {
          description: 'Attempting to reconnect...',
        });

        // Attempt to reconnect after 5 seconds
        reconnectTimer = setTimeout(() => {
          connect();
        }, 5000);
      };
    };

    connect();

    // Cleanup function
    return () => {
      if (eventSource) {
        eventSource.close();
        setIsConnected(false);
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [cast.id, cast.status]);

  return (
    <>
      <Toaster richColors position="top-right" />
      <div className="max-w-4xl space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {getStatusIcon(cast.status)}
                <h1 className="text-4xl font-bold">{cast.spell.name}</h1>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${getStatusColor(cast.status)} border`} variant="outline">
                  {cast.status.toUpperCase()}
                </Badge>
                {(cast.status === 'running' || cast.status === 'queued') && (
                  <Badge
                    variant="outline"
                    className={`flex items-center gap-1 ${
                      isConnected
                        ? 'text-green-500 border-green-500/20'
                        : 'text-red-500 border-red-500/20'
                    }`}
                  >
                    {isConnected ? (
                      <>
                        <Wifi className="h-3 w-3" />
                        Live
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3 w-3" />
                        Disconnected
                      </>
                    )}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <p className="text-white/60">{cast.spell.description}</p>
        </div>

        {/* Progress Indicator */}
        <CastProgress status={cast.status} startedAt={cast.startedAt} />

        <Separator className="bg-white text-black/10" />

        {/* Status Card */}
        <Card
          className={`border ${getStatusColor(cast.status).split(' ')[2] || 'border-white/10'}`}
        >
          <CardHeader>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Execution Status
              {isConnected && (
                <span className="text-xs text-white/60 font-normal">
                  (Last update: {lastUpdate.toLocaleTimeString()})
                </span>
              )}
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-white/60 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Started
                </p>
                <p className="font-mono text-sm">
                  {cast.startedAt ? new Date(cast.startedAt).toLocaleString() : 'Not started'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-white/60 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Finished
                </p>
                <p className="font-mono text-sm">
                  {cast.finishedAt ? new Date(cast.finishedAt).toLocaleString() : 'In progress'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-white/60 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Duration
                </p>
                <p className="font-mono text-sm">{formatDuration(cast.duration)}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-white/60 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Cost
                </p>
                <p className="font-mono text-sm">${(cast.costCents / 100).toFixed(2)}</p>
              </div>
            </div>

            <Separator className="bg-white text-black/10" />

            <div className="space-y-2">
              <p className="text-sm text-white/60">Cast ID</p>
              <code className="block bg-black/50 px-4 py-2 rounded text-xs font-mono">
                {cast.id}
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {cast.errorMessage && (
          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader>
              <h2 className="text-xl font-semibold flex items-center gap-2 text-red-500">
                <AlertCircle className="h-5 w-5" />
                Error Details
              </h2>
            </CardHeader>
            <CardContent>
              <div className="bg-black/50 p-4 rounded">
                <pre className="text-sm text-red-400 whitespace-pre-wrap font-mono">
                  {cast.errorMessage}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Artifact Download */}
        {cast.artifactUrl && (
          <Card className="border-white/10">
            <CardHeader>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Download className="h-5 w-5" />
                Output Artifact
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-white/60">The execution output is available for download.</p>
              <a href={cast.artifactUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full md:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Download Artifact
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* Spell Details */}
        <Card className="border-white/10">
          <CardHeader>
            <h2 className="text-xl font-semibold">Spell Details</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-white/60">Spell Name</p>
                <Link
                  href={`/spells/${cast.spell.id}`}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  {cast.spell.name}
                </Link>
              </div>
              <div>
                <p className="text-sm text-white/60">Version</p>
                <p className="font-mono">{cast.spell.version || '1.0.0'}</p>
              </div>
              <div>
                <p className="text-sm text-white/60">Execution Mode</p>
                <p>{cast.spell.executionMode || 'workflow'}</p>
              </div>
              <div>
                <p className="text-sm text-white/60">Category</p>
                <p>{cast.spell.category || 'Uncategorized'}</p>
              </div>
            </div>

            {cast.spell.tags && cast.spell.tags.length > 0 && (
              <div>
                <p className="text-sm text-white/60 mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {cast.spell.tags.map((tag: string) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Input Data */}
        {cast.inputHash && (
          <Card className="border-white/10">
            <CardHeader>
              <h2 className="text-xl font-semibold">Input Data</h2>
            </CardHeader>
            <CardContent>
              <div className="bg-black/50 p-4 rounded">
                <pre className="text-sm text-white/80 whitespace-pre-wrap font-mono overflow-x-auto">
                  {cast.inputHash}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Execution Timeline */}
        <Card className="border-white/10">
          <CardHeader>
            <h2 className="text-xl font-semibold">Timeline</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black/10">
                  <div className="h-3 w-3 rounded-full bg-white text-black" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Cast Created</p>
                  <p className="text-sm text-white/60">
                    {new Date(cast.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {cast.startedAt && (
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Execution Started</p>
                    <p className="text-sm text-white/60">
                      {new Date(cast.startedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {cast.finishedAt && (
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      cast.status === 'completed' ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}
                  >
                    <div
                      className={`h-3 w-3 rounded-full ${
                        cast.status === 'completed' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">
                      {cast.status === 'completed' ? 'Completed' : 'Failed'}
                    </p>
                    <p className="text-sm text-white/60">
                      {new Date(cast.finishedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Review Form (only show for completed casts) */}
        {cast.status === 'completed' && <ReviewForm castId={cast.id} spellName={cast.spell.name} />}
      </div>
    </>
  );
}
