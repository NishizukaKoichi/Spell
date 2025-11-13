'use client';

import type React from 'react';

import { useState, useEffect } from 'react';
import { CreditCard, Receipt, Plus, Trash2, Download, Scroll, Ban, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createSetupIntent, getPaymentMethods, removePaymentMethod } from '@/app/actions/stripe';
import { useLanguage } from '@/lib/i18n/language-provider';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentMethod {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

interface SpellBilling {
  id: string;
  name: string;
  category: string;
  cost: number;
  executedAt: string;
  status: string;
  image?: string; // Added image property for consistency with Bazaar
  type: 'one-time' | 'subscription' | 'pay-per-use' | 'license'; // Updated type to include three billing types: subscription, pay-per-use, and license
  details: {
    duration: string;
    parameters: Record<string, any>;
  };
}

function PaymentMethodForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Payment method added',
        });
        onSuccess();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to add payment method',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || isProcessing} className="w-full">
        {isProcessing ? 'Processing...' : 'Add Card'}
      </Button>
    </form>
  );
}

export function BillingView() {
  const { t } = useLanguage();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [selectedSpell, setSelectedSpell] = useState<SpellBilling | null>(null);
  const [filter, setFilter] = useState<'all' | 'subscription' | 'pay-per-use' | 'license'>('all'); // Added filter state for billing history filtering
  const { toast } = useToast();

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      const { paymentMethods: methods } = await getPaymentMethods();
      setPaymentMethods(methods);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load payment methods',
        variant: 'destructive',
      });
    }
  };

  const handleAddCard = async () => {
    try {
      const { clientSecret } = await createSetupIntent();
      setClientSecret(clientSecret!);
      setShowAddCard(true);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to initialize card setup',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveCard = async (paymentMethodId: string) => {
    try {
      await removePaymentMethod(paymentMethodId);
      toast({
        title: 'Success',
        description: 'Payment method removed',
      });
      loadPaymentMethods();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to remove payment method',
        variant: 'destructive',
      });
    }
  };

  const handleCardAdded = () => {
    setShowAddCard(false);
    setClientSecret(null);
    loadPaymentMethods();
  };

  const billingHistory: SpellBilling[] = [
    {
      id: 'spell-001',
      name: 'Time Acceleration Spell',
      category: 'Productivity',
      cost: 5.0,
      executedAt: '2025-01-15T14:30:00',
      status: 'Paid',
      image: '/time-acceleration-magic-clock.jpg', // Added image from Bazaar
      type: 'subscription', // Subscription type spell
      details: {
        duration: '2h 15m',
        parameters: {
          intensity: 'High',
          target: 'Project Alpha',
        },
      },
    },
    {
      id: 'spell-002',
      name: 'Creative Flames',
      category: 'Creative',
      cost: 7.0,
      executedAt: '2025-01-15T13:45:00',
      status: 'Paid',
      image: '/creative-flames-fire-art.jpg',
      type: 'pay-per-use', // Pay-per-use type spell
      details: {
        duration: '1h 30m',
        parameters: {
          style: 'Abstract',
          output: 'Digital Art',
        },
      },
    },
    {
      id: 'spell-003',
      name: 'Focus Barrier',
      category: 'Productivity',
      cost: 3.5,
      executedAt: '2025-01-10T12:30:00',
      status: 'Paid',
      type: 'pay-per-use', // Pay-per-use type spell
      details: {
        duration: '45m',
        parameters: {
          strength: 'Medium',
          duration: 'Extended',
        },
      },
    },
    {
      id: 'spell-004',
      name: 'Data Analysis Eye',
      category: 'Analytics',
      cost: 5.0,
      executedAt: '2025-01-10T11:00:00',
      status: 'Paid',
      image: '/data-analytics-eye-visualization.jpg', // Added image from Bazaar
      type: 'license', // License type spell
      details: {
        duration: '3h 20m',
        parameters: {
          dataset: 'Customer Behavior',
          depth: 'Deep',
        },
      },
    },
    {
      id: 'spell-005',
      name: 'Communication Bridge',
      category: 'Collaboration',
      cost: 4.25,
      executedAt: '2025-01-05T18:40:00',
      status: 'Paid',
      type: 'subscription', // Subscription type spell
      details: {
        duration: '1h 10m',
        parameters: {
          participants: 5,
          mode: 'Real-time',
        },
      },
    },
  ];

  const filteredBillingHistory =
    filter === 'all' ? billingHistory : billingHistory.filter((spell) => spell.type === filter); // Filter billing history based on selected type

  const downloadReceipt = (spell: SpellBilling) => {
    const receiptData = {
      receiptId: `RCP-${spell.id}`,
      spellName: spell.name,
      category: spell.category,
      executedAt: spell.executedAt,
      cost: spell.cost,
      status: spell.status,
      details: spell.details,
      currency: 'USD',
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(receiptData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${spell.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCancelSubscription = (spell: SpellBilling) => {
    toast({
      title: 'Subscription Cancelled',
      description: `${spell.name} subscription has been cancelled.`,
    });
    setSelectedSpell(null);
  };

  const getTypeLabel = (type: SpellBilling['type']) => {
    switch (type) {
      case 'subscription':
        return 'Subscription';
      case 'pay-per-use':
        return 'Pay-per-use';
      case 'license':
        return 'License';
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-12 z-10 border-b border-border/50 bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <CreditCard className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t.billing.title}</h2>
            <p className="text-sm text-muted-foreground">{t.billing.subtitle}</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-6xl space-y-6 p-4">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">{t.billing.paymentMethods}</h3>
              <Button size="sm" onClick={handleAddCard} className="gap-2">
                <Plus className="h-4 w-4" />
                {t.billing.addCard}
              </Button>
            </div>
            <div className="space-y-2">
              {paymentMethods.length === 0 ? (
                <div className="rounded-lg border border-border/50 bg-card/50 p-6 text-center">
                  <CreditCard className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t.billing.noPaymentMethods}</p>
                </div>
              ) : (
                paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-4 transition-all hover:scale-[1.01] hover:border-primary/50"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {method.card.brand.toUpperCase()} •••• {method.card.last4}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.billing.expires} {method.card.exp_month}/{method.card.exp_year}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCard(method.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">{t.billing.billingHistory}</h3>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="flex gap-1">
                <Button
                  variant={filter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('all')}
                  className={`h-7 px-2 text-xs ${filter === 'all' ? 'text-primary-foreground' : 'text-foreground'}`}
                >
                  {t.billing.all}
                </Button>
                <Button
                  variant={filter === 'subscription' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('subscription')}
                  className={`h-7 px-2 text-xs ${filter === 'subscription' ? 'text-primary-foreground' : 'text-foreground'}`}
                >
                  {t.billing.subscription}
                </Button>
                <Button
                  variant={filter === 'pay-per-use' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('pay-per-use')}
                  className={`h-7 px-2 text-xs ${filter === 'pay-per-use' ? 'text-primary-foreground' : 'text-foreground'}`}
                >
                  {t.billing.payPerUse}
                </Button>
                <Button
                  variant={filter === 'license' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('license')}
                  className={`h-7 px-2 text-xs ${filter === 'license' ? 'text-primary-foreground' : 'text-foreground'}`}
                >
                  {t.billing.license}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {filteredBillingHistory.map((spell) => (
                <div
                  key={spell.id}
                  onClick={() => setSelectedSpell(spell)}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-border/50 bg-card/50 p-3 transition-all hover:scale-[1.01] hover:border-primary/50"
                >
                  <div className="flex items-center gap-3">
                    {spell.image ? (
                      <img
                        src={spell.image || '/placeholder.svg'}
                        alt={spell.name}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10">
                        <Scroll className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{spell.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(spell.executedAt)} • {spell.category}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {getTypeLabel(spell.type)}
                    </Badge>
                    <p className="text-sm font-semibold text-foreground">
                      ${spell.cost.toFixed(2)}
                    </p>
                    <span className="text-xs text-green-500">{t.billing.paid}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
        <DialogContent
          className="max-h-[85vh] overflow-y-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t.billing.addPaymentMethod}</DialogTitle>
            <DialogDescription>{t.billing.addCreditCard}</DialogDescription>
          </DialogHeader>
          {clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentMethodForm onSuccess={handleCardAdded} />
            </Elements>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSpell} onOpenChange={(open) => !open && setSelectedSpell(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{t.billing.spellReceipt}</DialogTitle>
            <DialogDescription>{t.billing.detailedInfo}</DialogDescription>
          </DialogHeader>
          {selectedSpell && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                {selectedSpell.image ? (
                  <img
                    src={selectedSpell.image || '/placeholder.svg'}
                    alt={selectedSpell.name}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Scroll className="h-8 w-8 text-primary" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground">{selectedSpell.name}</h3>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="default">{selectedSpell.status}</Badge>
                    <Badge variant="outline">{getTypeLabel(selectedSpell.type)}</Badge> // Added
                    billing type badge in modal
                    <span className="text-sm text-muted-foreground">{selectedSpell.category}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{t.billing.chargeAmount}</p>
                  <p className="text-2xl font-bold text-foreground">
                    ${selectedSpell.cost.toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-semibold text-foreground">{t.billing.executionDetails}</h4>
                <div className="space-y-3 rounded-lg border border-border/50 bg-card/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t.billing.executedAt}</span>
                    <span className="text-sm font-medium text-foreground">
                      {formatDate(selectedSpell.executedAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t.billing.duration}</span>
                    <span className="text-sm font-medium text-foreground">
                      {selectedSpell.details.duration}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t.billing.category}</span>
                    <span className="text-sm font-medium text-foreground">
                      {selectedSpell.category}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-semibold text-foreground">{t.billing.parameters}</h4>
                <div className="space-y-2 rounded-lg border border-border/50 bg-card/50 p-4">
                  {Object.entries(selectedSpell.details.parameters).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm capitalize text-muted-foreground">{key}</span>
                      <span className="text-sm font-medium text-foreground">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <h4 className="mb-2 font-semibold text-foreground">
                  {t.billing.paymentInformation}
                </h4>
                <p className="text-sm text-muted-foreground">{t.billing.paymentInfoDesc}</p>
              </div>

              <div className="flex justify-end gap-2">
                {selectedSpell.type === 'subscription' && (
                  <Button
                    variant="destructive"
                    onClick={() => handleCancelSubscription(selectedSpell)}
                    className="gap-2"
                  >
                    <Ban className="h-4 w-4" />
                    {t.billing.cancelSubscription}
                  </Button>
                )}
                <Button onClick={() => downloadReceipt(selectedSpell)} className="gap-2">
                  <Download className="h-4 w-4" />
                  {t.billing.downloadReceipt}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
