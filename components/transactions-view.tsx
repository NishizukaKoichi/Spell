'use client';

import { useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  Activity,
  Calendar,
  Filter,
  Scroll,
  CheckCircle,
  XCircle,
  Loader2,
  Ban,
} from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/i18n/language-provider';

interface SpellExecution {
  id: string;
  spellName: string;
  category: 'Productivity' | 'Creative' | 'Analytics' | 'Collaboration';
  executedAt: string;
  status: 'success' | 'failed' | 'processing';
  image?: string;
  type: 'one-time' | 'subscription'; // Added type property for subscription support
}

const sampleExecutions: SpellExecution[] = [
  {
    id: 'exec-001',
    spellName: 'Time Acceleration Spell',
    category: 'Productivity',
    executedAt: '2025-10-31T14:30:00',
    status: 'success',
    image: '/time-acceleration-magic-clock.jpg',
    type: 'subscription', // Subscription type spell
  },
  {
    id: 'exec-002',
    spellName: 'Creative Flames',
    category: 'Creative',
    executedAt: '2025-10-31T13:45:00',
    status: 'processing',
    image: '/creative-flames-fire-art.jpg',
    type: 'one-time',
  },
  {
    id: 'exec-003',
    spellName: 'Focus Barrier',
    category: 'Productivity',
    executedAt: '2025-10-31T12:30:00',
    status: 'success',
    type: 'one-time',
  },
  {
    id: 'exec-004',
    spellName: 'Data Analysis Eye',
    category: 'Analytics',
    executedAt: '2025-10-31T11:00:00',
    status: 'success',
    image: '/data-analytics-eye-visualization.jpg',
    type: 'one-time',
  },
  {
    id: 'exec-005',
    spellName: 'Communication Bridge',
    category: 'Collaboration',
    executedAt: '2025-10-30T18:40:00',
    status: 'failed',
    type: 'one-time',
  },
  {
    id: 'exec-006',
    spellName: 'Automation Spirit',
    category: 'Productivity',
    executedAt: '2025-10-30T16:25:00',
    status: 'success',
    image: '/automation-spirit-robot-assistant.jpg',
    type: 'one-time',
  },
  {
    id: 'exec-007',
    spellName: 'Time Acceleration Spell',
    category: 'Productivity',
    executedAt: '2025-10-30T10:15:00',
    status: 'success',
    image: '/time-acceleration-magic-clock.jpg',
    type: 'subscription',
  },
  {
    id: 'exec-008',
    spellName: 'Creative Flames',
    category: 'Creative',
    executedAt: '2025-10-29T14:10:00',
    status: 'success',
    image: '/creative-flames-fire-art.jpg',
    type: 'one-time',
  },
];

export function TransactionsView() {
  const { t } = useLanguage();
  const [filterCategory, setFilterCategory] = useState<'all' | SpellExecution['category']>('all');
  const [selectedExecution, setSelectedExecution] = useState<SpellExecution | null>(null);
  const { toast } = useToast(); // Added toast hook

  const filteredExecutions =
    filterCategory === 'all'
      ? sampleExecutions
      : sampleExecutions.filter((execution) => execution.category === filterCategory);

  const getStatusBadge = (status: SpellExecution['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default">{t.transactions.success}</Badge>;
      case 'failed':
        return <Badge variant="destructive">{t.transactions.failed}</Badge>;
      case 'processing':
        return <Badge variant="secondary">{t.transactions.processing}</Badge>;
    }
  };

  const getStatusDescription = (status: SpellExecution['status']) => {
    switch (status) {
      case 'success':
        return t.transactions.spellExecutedSuccessfully;
      case 'failed':
        return t.transactions.spellExecutionFailed;
      case 'processing':
        return t.transactions.spellIsExecuting;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const successCount = sampleExecutions.filter((exec) => exec.status === 'success').length;
  const processingCount = sampleExecutions.filter((exec) => exec.status === 'processing').length;
  const failedCount = sampleExecutions.filter((exec) => exec.status === 'failed').length;

  const getStatusIcon = (status: SpellExecution['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
    }
  };

  const handleCancelSubscription = (execution: SpellExecution) => {
    toast({
      title: t.transactions.subscriptionCancelled,
      description: `${execution.spellName} ${t.transactions.subscriptionCancelledDesc}`,
    });
    setSelectedExecution(null);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="sticky top-12 z-40 border-b border-border bg-card p-2 sm:p-3 overscroll-behavior-none">
        <div className="mx-auto max-w-6xl flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t.transactions.title}</h1>
              <p className="text-sm text-muted-foreground">{t.transactions.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">{t.transactions.success}</p>
              <p className="text-lg font-bold text-green-500">{successCount}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">{t.transactions.processing}</p>
              <p className="text-lg font-bold text-yellow-500">{processingCount}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">{t.transactions.failed}</p>
              <p className="text-lg font-bold text-red-500">{failedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-[104px] z-30 border-b border-border bg-background p-2 sm:p-3 sm:top-[120px] overscroll-behavior-none">
        <div className="mx-auto max-w-6xl flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent text-foreground">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">{t.transactions.category}</span>
                {filterCategory !== 'all' && (
                  <Badge variant="secondary" className="ml-1">
                    1
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="start">
              <div className="space-y-1">
                <Button
                  variant={filterCategory === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start text-foreground"
                  onClick={() => setFilterCategory('all')}
                >
                  {t.transactions.all}
                </Button>
                <Button
                  variant={filterCategory === 'Productivity' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start text-foreground"
                  onClick={() => setFilterCategory('Productivity')}
                >
                  {t.transactions.productivity}
                </Button>
                <Button
                  variant={filterCategory === 'Creative' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start text-foreground"
                  onClick={() => setFilterCategory('Creative')}
                >
                  {t.transactions.creative}
                </Button>
                <Button
                  variant={filterCategory === 'Analytics' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start text-foreground"
                  onClick={() => setFilterCategory('Analytics')}
                >
                  {t.transactions.analytics}
                </Button>
                <Button
                  variant={filterCategory === 'Collaboration' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start text-foreground"
                  onClick={() => setFilterCategory('Collaboration')}
                >
                  {t.transactions.collaboration}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <div className="text-sm text-muted-foreground">
            {filteredExecutions.length} {t.transactions.executions}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 bg-background scroll-smooth">
        <div className="mx-auto max-w-6xl space-y-2 p-2 sm:p-3 bg-background">
          {filteredExecutions.map((execution) => (
            <Card
              key={execution.id}
              onClick={() => setSelectedExecution(execution)}
              className="p-4 transition-all duration-200 hover:bg-accent/50 hover:scale-[1.01] cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-1 items-start gap-3">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                    {execution.image ? (
                      <img
                        src={execution.image || '/placeholder.svg'}
                        alt={execution.spellName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Scroll className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{execution.spellName}</h3>
                      {getStatusIcon(execution.status)}
                      {getStatusBadge(execution.status)}
                    </div>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(execution.executedAt)}
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span className="text-muted-foreground">{execution.category}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <Dialog
        open={!!selectedExecution}
        onOpenChange={(open) => !open && setSelectedExecution(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">{t.transactions.executionDetails}</DialogTitle>
            <DialogDescription>{t.transactions.statusInfo}</DialogDescription>
          </DialogHeader>
          {selectedExecution && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                  {selectedExecution.image ? (
                    <img
                      src={selectedExecution.image || '/placeholder.svg'}
                      alt={selectedExecution.spellName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Scroll className="h-8 w-8 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground">
                    {selectedExecution.spellName}
                  </h3>
                  <div className="mt-2 flex items-center gap-2">
                    {getStatusIcon(selectedExecution.status)}
                    {getStatusBadge(selectedExecution.status)}
                    <span className="text-sm text-muted-foreground">
                      {selectedExecution.category}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.transactions.executionId}</p>
                    <p className="font-mono text-sm text-foreground">{selectedExecution.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.transactions.status}</p>
                    <div className="mt-1">{getStatusBadge(selectedExecution.status)}</div>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">{t.transactions.executedAt}</p>
                  <p className="text-foreground">{formatDate(selectedExecution.executedAt)}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">{t.transactions.category}</p>
                  <p className="text-foreground">{selectedExecution.category}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">{t.transactions.description}</p>
                  <p className="text-foreground">
                    {getStatusDescription(selectedExecution.status)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <h4 className="mb-2 font-semibold text-foreground">
                  {t.transactions.aboutExecutionStatus}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t.transactions.aboutExecutionStatusDesc}
                </p>
              </div>

              {selectedExecution.type === 'subscription' && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => handleCancelSubscription(selectedExecution)}
                    className="gap-2"
                  >
                    <Ban className="h-4 w-4" />
                    {t.transactions.cancelSubscription}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
