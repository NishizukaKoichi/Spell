import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';

// GET /api/passkeys - Get all passkeys for authenticated user
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authenticators = await prisma.authenticators.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        credentialID: true,
        credentialDeviceType: true,
        credentialBackedUp: true,
        counter: true,
        name: true,
        createdAt: true,
        lastUsedAt: true,
        transports: true,
      },
    });

    return NextResponse.json({ passkeys: authenticators });
  } catch (error) {
    console.error('Get passkeys error:', error);
    return NextResponse.json({ error: 'Failed to retrieve passkeys' }, { status: 500 });
  }
}

// DELETE /api/passkeys - Delete a specific passkey
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { credentialID } = await req.json();

    if (!credentialID) {
      return NextResponse.json({ error: 'credentialID is required' }, { status: 400 });
    }

    // Check if the passkey belongs to the user
    const authenticator = await prisma.authenticators.findUnique({
      where: { credentialID },
      select: { userId: true },
    });

    if (!authenticator) {
      return NextResponse.json({ error: 'Passkey not found' }, { status: 404 });
    }

    if (authenticator.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if this is the last passkey - prevent deletion if it is
    const passkeyCount = await prisma.authenticators.count({
      where: { userId: session.user.id },
    });

    if (passkeyCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete your last passkey. Add another passkey before deleting this one.' },
        { status: 400 }
      );
    }

    // Delete the passkey
    await prisma.authenticators.delete({
      where: { credentialID },
    });

    return NextResponse.json({ success: true, message: 'Passkey deleted successfully' });
  } catch (error) {
    console.error('Delete passkey error:', error);
    return NextResponse.json({ error: 'Failed to delete passkey' }, { status: 500 });
  }
}
