export interface Spell {
  id: string
  key: string // e.g., "com.acme.resize"
  name: string
  description: string
  longDescription?: string
  author: {
    id: string
    name: string
    avatar: string
  }
  price: {
    model: 'flat' | 'metered' | 'one_time'
    amount: number // in cents
    currency: string
  }
  tags: string[]
  executionMode: 'workflow' | 'service' | 'clone'
  rating: number
  totalCasts: number
  inputSchema?: Record<string, unknown>
  reviews?: Review[]
}

export interface Review {
  user: string
  rating: number
  comment: string
}
