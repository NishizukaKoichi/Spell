import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, assertAdminAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type BanAction = 'ban' | 'unban'

export async function POST(request: NextRequest) {
  try {
    const adminId = await authenticateRequest(request.headers)
    assertAdminAccess(adminId)

    const { userId, reason, action = 'ban' } = await request.json()

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (action === 'ban' && (!reason || typeof reason !== 'string')) {
      return NextResponse.json({ error: 'reason is required to ban a user' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (action === 'unban') {
      await prisma.ban.delete({ where: { userId } }).catch(() => null)
      await prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } })

      return NextResponse.json({ message: 'User unbanned' })
    }

    if (action !== 'ban') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
    }

    await prisma.ban.upsert({
      where: { userId },
      create: { userId, reason },
      update: { reason }
    })

    await prisma.user.update({
      where: { id: userId },
      data: { status: 'BANNED' }
    })

    return NextResponse.json({ message: 'User banned' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
