import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import { cookies } from 'next/headers';
import { encode } from 'next-auth/jwt';

const rpID = process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '') ?? 'localhost';
const origin = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

export async function POST(req: NextRequest) {
  try {
    const { response } = (await req.json()) as {
      response: AuthenticationResponseJSON;
    };

    if (!response) {
      return NextResponse.json({ error: 'Missing authentication response' }, { status: 400 });
    }

    // Get challenge from cookie
    const cookieStore = await cookies();
    const challenge = cookieStore.get('webauthn-challenge')?.value;

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found or expired' }, { status: 400 });
    }

    // Find authenticator by credential ID
    const authenticator = await prisma.authenticators.findUnique({
      where: { credentialID: response.id },
      include: { users: true },
    });

    if (!authenticator) {
      return NextResponse.json({ error: 'Authenticator not found' }, { status: 404 });
    }

    // Verify the authentication response
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(authenticator.credentialID, 'base64url'),
        credentialPublicKey: Buffer.from(authenticator.credentialPublicKey, 'base64'),
        counter: authenticator.counter,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 400 });
    }

    // Update authenticator counter
    await prisma.authenticators.update({
      where: {
        userId_credentialID: {
          userId: authenticator.users.id,
          credentialID: authenticator.credentialID,
        },
      },
      data: {
        counter: verification.authenticationInfo.newCounter,
      },
    });

    // Clear the challenge cookie
    cookieStore.delete('webauthn-challenge');

    // Create NextAuth session manually by setting JWT token cookie
    try {
      const secret = process.env.AUTH_SECRET;
      if (!secret) {
        throw new Error('AUTH_SECRET is not configured');
      }

      const token = await encode({
        token: {
          id: authenticator.users.id,
          email: authenticator.users.email,
          name: authenticator.users.name,
          sub: authenticator.users.id,
        },
        secret,
        salt: 'auth-verify',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });

      // Set session token cookie (NextAuth uses this name by default)
      cookieStore.set('authjs.session-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });
    } catch (error) {
      console.error('[AuthVerify] Session creation error:', error);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      userId: authenticator.users.id,
      email: authenticator.users.email,
    });
  } catch (error) {
    console.error('Authentication verification error:', error);
    return NextResponse.json({ error: 'Failed to verify authentication' }, { status: 500 });
  }
}
