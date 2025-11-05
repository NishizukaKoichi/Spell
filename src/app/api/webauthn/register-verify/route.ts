import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { cookies } from 'next/headers';
import { encode } from 'next-auth/jwt';

const rpID = process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '') ?? 'localhost';
const origin = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

export async function POST(req: NextRequest) {
  try {
    const { response } = (await req.json()) as {
      response: RegistrationResponseJSON;
    };

    if (!response) {
      return NextResponse.json({ error: 'Missing registration response' }, { status: 400 });
    }

    // Get challenge and user info from cookies
    const cookieStore = await cookies();
    const challenge = cookieStore.get('webauthn-reg-challenge')?.value;
    const email = cookieStore.get('webauthn-reg-email')?.value;
    const userID = cookieStore.get('webauthn-reg-userid')?.value;

    if (!challenge || !email || !userID) {
      return NextResponse.json({ error: 'Registration session expired' }, { status: 400 });
    }

    // Verify the registration response
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

    // Create or update user
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        id: userID,
        email,
        name: email.split('@')[0],
      },
      update: {},
    });

    // Save authenticator
    await prisma.authenticators.create({
      data: {
        userId: user.id,
        credentialID: Buffer.from(credentialID).toString('base64url'),
        providerAccountId: user.id,
        credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64'),
        counter,
        credentialDeviceType: 'passkey',
        credentialBackedUp: false,
        transports: response.response.transports?.join(','),
      },
    });

    // Clear registration cookies
    cookieStore.delete('webauthn-reg-challenge');
    cookieStore.delete('webauthn-reg-email');
    cookieStore.delete('webauthn-reg-userid');

    // Create NextAuth session manually by setting JWT token cookie
    try {
      const secret = process.env.AUTH_SECRET;
      if (!secret) {
        throw new Error('AUTH_SECRET is not configured');
      }

      const token = await encode({
        token: {
          id: user.id,
          email: user.email,
          name: user.name,
          sub: user.id,
        },
        secret,
        salt: 'register-verify',
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

      console.log('[RegisterVerify] Session created for user:', user.email);
    } catch (error) {
      console.error('[RegisterVerify] Session creation error:', error);
      // Continue even if session creation fails
    }

    return NextResponse.json({
      success: true,
      message: 'Passkey registered successfully',
      userId: user.id,
      email: user.email,
    });
  } catch (error) {
    console.error('Registration verification error:', error);
    return NextResponse.json({ error: 'Failed to verify registration' }, { status: 500 });
  }
}
