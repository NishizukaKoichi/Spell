'use client';

import { BazaarMarketplace } from '@/components/bazaar-marketplace';

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-background">
      <BazaarMarketplace mode="bazaar" />
    </div>
  );
}
