'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { startRegistration } from '@simplewebauthn/browser';
import { toast } from 'sonner';

interface AddPasskeyDialogProps {
  children: React.ReactNode;
  onSuccess?: () => void;
}

export function AddPasskeyDialog({ children, onSuccess }: AddPasskeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddPasskey = async () => {
    setLoading(true);

    try {
      // Get registration options
      const optionsResponse = await fetch('/api/passkeys/add-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined }),
      });

      if (!optionsResponse.ok) {
        const error = await optionsResponse.json();
        throw new Error(error.error || 'Failed to get registration options');
      }

      const { options } = await optionsResponse.json();

      // Start WebAuthn registration
      const registrationResponse = await startRegistration(options);

      // Verify registration
      const verifyResponse = await fetch('/api/passkeys/add-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: registrationResponse,
        }),
      });

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.error || 'Registration failed');
      }

      toast.success('Passkey added successfully');
      setOpen(false);
      setName('');
      onSuccess?.();
    } catch (error) {
      console.error('Add passkey error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add passkey');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!loading) {
      setOpen(newOpen);
      if (!newOpen) {
        setName('');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="border-white/10">
        <DialogHeader>
          <DialogTitle>Add New Passkey</DialogTitle>
          <DialogDescription>
            Register a new passkey for this account. You can use a different device or browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="passkey-name">Passkey Name (Optional)</Label>
            <Input
              id="passkey-name"
              placeholder="e.g., My iPhone, Work Laptop"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="bg-white/5 border-white/10"
            />
            <p className="text-xs text-white/60">
              Give this passkey a friendly name to help you identify it later.
            </p>
          </div>

          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-400">
            <p className="font-semibold mb-1">What happens next?</p>
            <p>
              You'll be prompted to use your device's biometric authentication (fingerprint, face
              recognition) or PIN to create a new passkey.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
            className="border-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddPasskey}
            disabled={loading}
            className="bg-white hover:bg-white/90 text-black"
          >
            {loading ? 'Adding...' : 'Add Passkey'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
