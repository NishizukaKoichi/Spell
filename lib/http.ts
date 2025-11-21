import { NextResponse } from 'next/server'

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      data
    },
    { status }
  )
}

export function jsonError(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, unknown> | null
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {})
      }
    },
    { status }
  )
}
