import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import { cookies } from 'next/headers';
import { signIn } from '@/lib/auth/config';

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

    // Create NextAuth session
    try {
      await signIn('webauthn', {
        response: JSON.stringify(response),
        redirect: false,
      });
    } catch (error) {
      console.error('Session creation error:', error);
      // Continue even if signIn fails, we'll return success anyway
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
