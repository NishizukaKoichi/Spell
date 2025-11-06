import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { logApiKeyRevoked, getIpAddress } from '@/lib/audit-log';

// DELETE /api/keys/[id] - Delete an API key
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify the key belongs to the user
    const apiKey = await prisma.api_keys.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    // Delete the key
    await prisma.api_keys.delete({
      where: {
        id,
      },
    });

    // Log API key revocation
    const ipAddress = getIpAddress(req);
    await logApiKeyRevoked(session.user.id, id, apiKey.name, ipAddress);

    return NextResponse.json({ message: 'API key deleted successfully' });
  } catch (error) {
    console.error('Failed to delete API key:', error);
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }
}
