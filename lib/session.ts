export type SessionUser = {
  sub: string
  name?: string
}

export type Session = {
  authenticated: boolean
  user?: SessionUser
}

const API_BASE = (process.env.NEXT_PUBLIC_EDGE_BASE_URL || '').replace(/\/$/, '')

function resolveUrl(path: string) {
  if (!API_BASE) return path
  return `${API_BASE}${path}`
}

export async function fetchSession(init: RequestInit = {}): Promise<Session | null> {
  const res = await fetch(resolveUrl('/api/session'), {
    credentials: 'include',
    cache: 'no-store',
    ...init,
  })
  if (res.status === 401) return null
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to fetch session: ${res.status} ${text}`)
  }
  return (await res.json()) as Session
}

export async function logout(init: RequestInit = {}): Promise<void> {
  const res = await fetch(resolveUrl('/api/logout'), {
    method: 'POST',
    credentials: 'include',
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to logout: ${res.status} ${text}`)
  }
}
