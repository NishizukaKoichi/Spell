import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type FormatCurrencyOptions = {
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export function formatCurrency(
  amountInCents: number,
  options: FormatCurrencyOptions = {}
) {
  if (!Number.isFinite(amountInCents)) {
    throw new Error('Invalid amount');
  }

  const {
    currency = 'USD',
    locale = 'en-US',
    minimumFractionDigits,
    maximumFractionDigits,
  } = options;

  const resolvedDefaults = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).resolvedOptions();

  const defaultMin =
    resolvedDefaults.minimumFractionDigits ?? 2;
  const defaultMax =
    resolvedDefaults.maximumFractionDigits ?? Math.max(defaultMin, 2);

  const finalMin = minimumFractionDigits ?? defaultMin;
  const finalMax =
    maximumFractionDigits ?? Math.max(defaultMax, finalMin);

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: finalMin,
    maximumFractionDigits: finalMax,
  });

  const amount = amountInCents / 100;

  return formatter.format(amount);
}
