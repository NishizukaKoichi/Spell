'use client';

import { useState } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { FileCheck, CheckCircle2, Clock, XCircle, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useLanguage } from '@/lib/i18n/language-provider';

interface License {
  id: string;
  spellName: string;
  author: string;
  category: string;
  purchasedAt: string;
  expiresAt: string | null;
  status: 'active' | 'expired' | 'pending';
  licenseKey: string;
  licenseFee: number;
  type: 'one-time' | 'subscription';
}

export function LicensesView() {
  const { t } = useLanguage();
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);

  const licenses: License[] = [
    {
      id: '1',
      spellName: 'Time Acceleration',
      author: 'Chronos Mage',
      category: 'Productivity',
      purchasedAt: '2024-01-15T10:30:00Z',
      expiresAt: null,
      status: 'active',
      licenseKey: 'TA-XXXX-XXXX-XXXX',
      licenseFee: 5000,
      type: 'one-time',
    },
    {
      id: '2',
      spellName: 'Creative Flames',
      author: 'Pyro Artist',
      category: 'Creative',
      purchasedAt: '2024-02-20T14:15:00Z',
      expiresAt: '2025-02-20T14:15:00Z',
      status: 'active',
      licenseKey: 'CF-XXXX-XXXX-XXXX',
      licenseFee: 1200,
      type: 'subscription',
    },
    {
      id: '3',
      spellName: 'Data Insight',
      author: 'Oracle Sage',
      category: 'Analytics',
      purchasedAt: '2023-12-01T09:00:00Z',
      expiresAt: '2024-12-01T09:00:00Z',
      status: 'expired',
      licenseKey: 'DI-XXXX-XXXX-XXXX',
      licenseFee: 800,
      type: 'subscription',
    },
    {
      id: '4',
      spellName: 'Shield Protocol',
      author: 'Guardian Wizard',
      category: 'Security',
      purchasedAt: '2024-03-10T16:45:00Z',
      expiresAt: null,
      status: 'active',
      licenseKey: 'SP-XXXX-XXXX-XXXX',
      licenseFee: 8000,
      type: 'one-time',
    },
    {
      id: '5',
      spellName: 'Memory Enhancement',
      author: 'Mind Master',
      category: 'Productivity',
      purchasedAt: '2024-03-25T11:20:00Z',
      expiresAt: '2024-06-25T11:20:00Z',
      status: 'pending',
      licenseKey: 'ME-XXXX-XXXX-XXXX',
      licenseFee: 600,
      type: 'subscription',
    },
  ];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return t('licenses.active');
      case 'expired':
        return t('licenses.expired');
      case 'pending':
        return t('licenses.pending');
      default:
        return status;
    }
  };

  const activeLicenses = licenses.filter((l) => l.status === 'active').length;
  const totalLicenses = licenses.length;
  const totalLicenseFees = licenses.reduce((sum, license) => sum + license.licenseFee, 0);

  const downloadLicense = (license: License) => {
    const licenseData = {
      licenseId: license.id,
      spellName: license.spellName,
      author: license.author,
      category: license.category,
      licenseKey: license.licenseKey,
      licenseFee: license.licenseFee,
      licenseType: license.type,
      purchasedAt: license.purchasedAt,
      expiresAt: license.expiresAt,
      status: license.status,
      currency: 'JPY',
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(licenseData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `license-${license.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="sticky top-12 z-40 border-b border-border bg-background p-2 sm:p-3 overscroll-behavior-none">
        <div className="mx-auto max-w-6xl flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FileCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t.licenses.title}</h1>
            <p className="text-sm text-muted-foreground">{t.licenses.description}</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="sticky top-[104px] z-30 border-b border-border bg-background p-2 sm:p-3 overscroll-behavior-none">
        <div className="mx-auto max-w-6xl flex gap-6">
          <div>
            <p className="text-sm text-muted-foreground">{t.licenses.totalLicenses}</p>
            <p className="text-2xl font-bold text-foreground">{totalLicenses}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t.licenses.activeLicenses}</p>
            <p className="text-2xl font-bold text-green-500">{activeLicenses}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t.licenses.totalLicenseFees}</p>
            <p className="text-2xl font-bold text-foreground">
              ¥{totalLicenseFees.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Licenses List */}
      <ScrollArea className="flex-1 bg-background scroll-smooth">
        <div className="mx-auto max-w-6xl space-y-3 p-2 sm:p-3 bg-background">
          {licenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t.licenses.noLicensesYet}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {t.licenses.noLicensesDescription}
                <br />
                {t.licenses.noLicensesNote}
              </p>
            </div>
          ) : (
            licenses.map((license) => (
              <div
                key={license.id}
                onClick={() => setSelectedLicense(license)}
                className="rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:bg-accent/50 hover:scale-[1.01] cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{license.spellName}</h3>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(license.status)}
                        <span className="text-sm text-muted-foreground">
                          {getStatusText(license.status)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">by {license.author}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t.licenses.category}: </span>
                        <span className="text-foreground">{license.category}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t.licenses.typeLabel}: </span>
                        <span className="text-foreground">
                          {license.type === 'one-time'
                            ? t.licenses.oneTime
                            : t.licenses.subscription}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t.licenses.purchased}: </span>
                        <span className="text-foreground">{formatDate(license.purchasedAt)}</span>
                      </div>
                      {license.expiresAt && (
                        <div>
                          <span className="text-muted-foreground">{t.licenses.expires}: </span>
                          <span className="text-foreground">{formatDate(license.expiresAt)}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">{t.licenses.licenseFee}: </span>
                        <span className="text-foreground font-semibold">
                          ¥{license.licenseFee.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="text-muted-foreground text-sm">
                        {t.licenses.licenseKey}:{' '}
                      </span>
                      <code className="rounded bg-muted px-2 py-1 text-sm text-foreground font-mono">
                        {license.licenseKey}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="h-20 bg-background" />
      </ScrollArea>

      {/* Modal for license details */}
      <Dialog open={!!selectedLicense} onOpenChange={(open) => !open && setSelectedLicense(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">{t.licenses.licenseDetails}</DialogTitle>
            <DialogDescription>{t.licenses.detailedInfo}</DialogDescription>
          </DialogHeader>
          {selectedLicense && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <FileCheck className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground">{selectedLicense.spellName}</h3>
                  <p className="mt-1 text-muted-foreground">by {selectedLicense.author}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {getStatusIcon(selectedLicense.status)}
                    <span className="text-sm font-medium text-foreground">
                      {getStatusText(selectedLicense.status)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.licenses.licenseId}</p>
                    <p className="font-mono text-sm text-foreground">{selectedLicense.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.licenses.licenseFee}</p>
                    <p className="text-xl font-bold text-foreground">
                      ¥{selectedLicense.licenseFee.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">{t.licenses.licenseKey}</p>
                  <code className="block rounded bg-background px-3 py-2 font-mono text-sm text-foreground">
                    {selectedLicense.licenseKey}
                  </code>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.licenses.licenseType}</p>
                    <Badge variant="outline" className="mt-1">
                      {selectedLicense.type === 'one-time'
                        ? t.licenses.oneTimePurchase
                        : t.licenses.subscription}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.licenses.category}</p>
                    <p className="text-foreground">{selectedLicense.category}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.licenses.purchasedAt}</p>
                    <p className="text-foreground">{formatDate(selectedLicense.purchasedAt)}</p>
                  </div>
                  {selectedLicense.expiresAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t.licenses.expiresAt}</p>
                      <p className="text-foreground">{formatDate(selectedLicense.expiresAt)}</p>
                    </div>
                  )}
                  {!selectedLicense.expiresAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t.licenses.validity}</p>
                      <p className="text-foreground">{t.licenses.lifetime}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <h4 className="mb-2 font-semibold text-foreground">
                  {t.licenses.aboutLicenseFees}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t.licenses.aboutLicenseFeesDescription}
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => downloadLicense(selectedLicense)} className="gap-2">
                  <Download className="h-4 w-4" />
                  {t.licenses.downloadLicense}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
