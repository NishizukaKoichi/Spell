'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2, Key, Smartphone, Laptop, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PasskeyCardProps {
  passkey: {
    credentialID: string;
    credentialDeviceType: string;
    credentialBackedUp: boolean;
    counter: number;
    name: string | null;
    createdAt: Date;
    lastUsedAt: Date | null;
  };
  onDelete: (credentialID: string) => Promise<void>;
}

export function PasskeyCard({ passkey, onDelete }: PasskeyCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(passkey.credentialID);
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getDeviceIcon = () => {
    const type = passkey.credentialDeviceType.toLowerCase();
    if (type.includes('phone') || type.includes('mobile')) {
      return <Smartphone className="h-5 w-5" />;
    } else if (type.includes('laptop') || type.includes('desktop') || type.includes('computer')) {
      return <Laptop className="h-5 w-5" />;
    }
    return <Key className="h-5 w-5" />;
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 p-4 bg-white/5">
      <div className="flex items-center gap-4 flex-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
          {getDeviceIcon()}
        </div>
        <div className="space-y-1 flex-1">
          <p className="font-medium">
            {passkey.name || `Passkey #${passkey.credentialID.slice(0, 8)}`}
          </p>
          <p className="text-xs text-white/40 font-mono">
            ID: {passkey.credentialID.slice(0, 20)}...
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              {passkey.credentialDeviceType}
            </Badge>
            {passkey.credentialBackedUp && (
              <Badge variant="outline" className="text-xs text-green-500 border-green-500/20">
                Backed Up
              </Badge>
            )}
            <Badge variant="outline" className="text-xs text-blue-500 border-blue-500/20">
              Used {passkey.counter} times
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right text-sm text-white/60">
          <div className="flex items-center gap-1 mb-1">
            <Clock className="h-3 w-3" />
            <span className="text-xs">Created</span>
          </div>
          <p className="text-xs">
            {formatDistanceToNow(new Date(passkey.createdAt), { addSuffix: true })}
          </p>
          {passkey.lastUsedAt && (
            <>
              <div className="flex items-center gap-1 mt-2">
                <Clock className="h-3 w-3" />
                <span className="text-xs">Last used</span>
              </div>
              <p className="text-xs">
                {formatDistanceToNow(new Date(passkey.lastUsedAt), { addSuffix: true })}
              </p>
            </>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-white/10">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Passkey</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this passkey? This action cannot be undone.
                {!passkey.name && (
                  <span className="block mt-2 text-xs font-mono">
                    {passkey.credentialID.slice(0, 20)}...
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
