'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface AuditLogListProps {
  /** Optional: limit logs to specific actions */
  actionFilter?: string;
  /** Optional: limit logs to specific resource types */
  resourceFilter?: string;
  /** Optional: page size */
  pageSize?: number;
  /** Optional: show filters UI */
  showFilters?: boolean;
}

export function AuditLogList({
  actionFilter,
  resourceFilter,
  pageSize = 50,
  showFilters = true,
}: AuditLogListProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  // Filter states
  const [selectedAction, setSelectedAction] = useState<string>(actionFilter || 'all');
  const [selectedResource, setSelectedResource] = useState<string>(resourceFilter || 'all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, [page, selectedAction, selectedResource, selectedStatus]);

  async function fetchLogs() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      if (selectedAction !== 'all') {
        params.append('action', selectedAction);
      }
      if (selectedResource !== 'all') {
        params.append('resource', selectedResource);
      }
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }

      const response = await fetch(`/api/audit-logs?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data = await response.json();
      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);
      setHasNextPage(data.pagination.hasNextPage);
      setHasPreviousPage(data.pagination.hasPreviousPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  }

  function getStatusBadgeVariant(status: string): 'default' | 'destructive' | 'secondary' {
    switch (status) {
      case 'success':
        return 'default';
      case 'failure':
        return 'destructive';
      default:
        return 'secondary';
    }
  }

  function formatActionName(action: string): string {
    return action
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  if (loading && logs.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <p className="text-muted-foreground">Loading audit logs...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <p className="text-destructive">Error: {error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <Card className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Action</label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="auth.login">Login</SelectItem>
                  <SelectItem value="auth.logout">Logout</SelectItem>
                  <SelectItem value="auth.register">Register</SelectItem>
                  <SelectItem value="spell.created">Spell Created</SelectItem>
                  <SelectItem value="spell.updated">Spell Updated</SelectItem>
                  <SelectItem value="spell.deleted">Spell Deleted</SelectItem>
                  <SelectItem value="cast.created">Cast Created</SelectItem>
                  <SelectItem value="cast.completed">Cast Completed</SelectItem>
                  <SelectItem value="payment.success">Payment Success</SelectItem>
                  <SelectItem value="api_key.created">API Key Created</SelectItem>
                  <SelectItem value="api_key.revoked">API Key Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Resource</label>
              <Select value={selectedResource} onValueChange={setSelectedResource}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by resource" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="spell">Spell</SelectItem>
                  <SelectItem value="cast">Cast</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="budget">Budget</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No audit logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">{formatDate(log.createdAt)}</TableCell>
                  <TableCell>
                    <span className="font-medium">{formatActionName(log.action)}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.resource}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(log.status)}>{log.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.ipAddress || '-'}</TableCell>
                  <TableCell>
                    {log.errorMessage ? (
                      <span className="text-xs text-destructive">{log.errorMessage}</span>
                    ) : log.metadata ? (
                      <details className="cursor-pointer">
                        <summary className="text-xs text-muted-foreground">View metadata</summary>
                        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-w-md">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={!hasPreviousPage || loading}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={!hasNextPage || loading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
