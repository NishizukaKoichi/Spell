export interface Spell {
  id: string;
  key: string;
  name: string;
  description: string;
  longDescription?: string | null;
  version: string;
  priceModel: string;
  priceAmount: number;
  priceCurrency: string;
  executionMode: string;
  tags: string[];
  category?: string | null;
  rating: number;
  totalCasts: number;
  inputSchema?: unknown;
  outputSchema?: unknown;
  authorId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Cast {
  id: string;
  spellId: string;
  casterId: string;
  status: string;
  inputHash?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  duration?: number | null;
  costCents: number;
  artifactUrl?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
