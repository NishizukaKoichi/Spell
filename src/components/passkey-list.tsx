'use client';

import { useState, useEffect } from 'react';
import { PasskeyCard } from '@/components/passkey-card';
import { AddPasskeyDialog } from '@/components/add-passkey-dialog';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Passkey {
  credentialID: string;
  credentialDeviceType: string;
  credentialBackedUp: boolean;
  counter: number;
  name: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export function PasskeyList() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPasskeys = async () => {
    try {
      const response = await fetch('/api/passkeys');
      if (!response.ok) {
        throw new Error('Failed to fetch passkeys');
      }
      const data = await response.json();
      setPasskeys(data.passkeys);
    } catch (error) {
      console.error('Fetch passkeys error:', error);
      toast.error('Failed to load passkeys');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPasskeys();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPasskeys();
  };

  const handleDelete = async (credentialID: string) => {
    try {
      const response = await fetch('/api/passkeys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialID }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete passkey');
      }

      toast.success('Passkey deleted successfully');
      await fetchPasskeys();
    } catch (error) {
      console.error('Delete passkey error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete passkey');
      throw error;
    }
  };

  const handlePasskeyAdded = () => {
    fetchPasskeys();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 rounded-lg border border-white/10 bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">
          {passkeys.length} {passkeys.length === 1 ? 'passkey' : 'passkeys'} registered
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-white/10"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <AddPasskeyDialog onSuccess={handlePasskeyAdded}>
            <Button size="sm" className="bg-white hover:bg-white/90 text-black">
              <Plus className="h-4 w-4 mr-2" />
              Add Passkey
            </Button>
          </AddPasskeyDialog>
        </div>
      </div>

      {passkeys.length === 0 ? (
        <div className="text-center py-8 text-white/60">
          <p>No passkeys registered</p>
          <p className="text-sm mt-2">Add a passkey to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {passkeys.map((passkey) => (
            <PasskeyCard key={passkey.credentialID} passkey={passkey} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
