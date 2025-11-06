import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

const rpName = 'Spell Platform';
const rpID = process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '') ?? 'localhost';

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
      include: { authenticators: true },
    });

    const userID = user?.id ?? crypto.randomUUID();

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID,
      userName: email,
      userDisplayName: email.split('@')[0],
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials:
        user?.authenticators.map((auth: { credentialID: string }) => ({
          id: Buffer.from(auth.credentialID, 'base64url'),
          type: 'public-key' as const,
        })) ?? [],
    });

    // Store challenge and user info in secure HTTP-only cookies
    const cookieStore = await cookies();
    cookieStore.set('webauthn-reg-challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 5, // 5 minutes
      path: '/',
    });
    cookieStore.set('webauthn-reg-email', email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 5, // 5 minutes
      path: '/',
    });
    cookieStore.set('webauthn-reg-userid', userID, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 5, // 5 minutes
      path: '/',
    });
    if (name) {
      cookieStore.set('webauthn-reg-name', name, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 5, // 5 minutes
        path: '/',
      });
    }

    return NextResponse.json({ options });
  } catch (error) {
    console.error('Registration options error:', error);
    return NextResponse.json({ error: 'Failed to generate registration options' }, { status: 500 });
  }
}
