import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface FormatCurrencyOptions {
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function formatCurrency(amountInCents: number, options?: FormatCurrencyOptions): string {
  if (!Number.isFinite(amountInCents)) {
    throw new Error('Invalid amount: must be a finite number');
  }

  const {
    currency = 'USD',
    locale = 'en-US',
    minimumFractionDigits,
    maximumFractionDigits,
  } = options || {};

  const dollars = amountInCents / 100;

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  });

  return formatter.format(dollars);
}
