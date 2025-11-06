import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

const rpName = 'Spell Platform';
const rpID = process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '') ?? 'localhost';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await req.json();

    // Get user's existing authenticators
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { authenticators: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: user.id,
      userName: user.email,
      userDisplayName: user.name || user.email.split('@')[0],
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: user.authenticators.map((auth: { credentialID: string }) => ({
        id: Buffer.from(auth.credentialID, 'base64url'),
        type: 'public-key' as const,
      })),
    });

    // Store challenge and passkey name in secure HTTP-only cookies
    const cookieStore = await cookies();
    cookieStore.set('webauthn-add-challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 5, // 5 minutes
      path: '/',
    });

    if (name) {
      cookieStore.set('webauthn-add-name', name, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 5, // 5 minutes
        path: '/',
      });
    }

    return NextResponse.json({ options });
  } catch (error) {
    console.error('Add passkey options error:', error);
    return NextResponse.json({ error: 'Failed to generate registration options' }, { status: 500 });
  }
}
