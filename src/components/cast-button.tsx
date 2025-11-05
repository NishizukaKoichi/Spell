'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface CastButtonProps {
  spellId: string;
  priceAmountCents?: number;
}

export function CastButton({ spellId, priceAmountCents = 0 }: CastButtonProps) {
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  const handleCast = async () => {
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    setLoading(true);

    try {
      // If spell requires payment, redirect to Stripe checkout
      if (priceAmountCents > 0) {
        const checkoutResponse = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ spellId }),
        });

        if (!checkoutResponse.ok) {
          const error = await checkoutResponse.json();
          throw new Error(error.error || 'Failed to create checkout session');
        }

        const { url } = await checkoutResponse.json();
        window.location.href = url;
        return;
      }

      // For free spells, cast directly
      const response = await fetch('/api/cast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spellId,
          input: {},
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to cast spell');
        return;
      }

      const data = await response.json();
      alert(`Cast initiated! Cast ID: ${data.cast.id}`);
      router.push('/casts');
    } catch (error) {
      console.error('Cast error:', error);
      alert('Failed to cast spell');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="lg"
      onClick={handleCast}
      disabled={loading}
      className="gap-2 bg-white hover:bg-white text-black/90"
    >
      <Zap className="h-5 w-5" />
      {loading
        ? 'Processing...'
        : priceAmountCents > 0
          ? `Cast for $${(priceAmountCents / 100).toFixed(2)}`
          : 'Cast Spell'}
    </Button>
  );
}
