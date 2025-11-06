import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { cookies } from 'next/headers';

const rpID = process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '') ?? 'localhost';
const origin = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { response } = (await req.json()) as {
      response: RegistrationResponseJSON;
    };

    if (!response) {
      return NextResponse.json({ error: 'Missing registration response' }, { status: 400 });
    }

    // Get challenge and name from cookies
    const cookieStore = await cookies();
    const challenge = cookieStore.get('webauthn-add-challenge')?.value;
    const name = cookieStore.get('webauthn-add-name')?.value;

    if (!challenge) {
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

    // Check if credential already exists
    const existingAuth = await prisma.authenticators.findUnique({
      where: { credentialID: Buffer.from(credentialID).toString('base64url') },
    });

    if (existingAuth) {
      return NextResponse.json({ error: 'This passkey is already registered' }, { status: 400 });
    }

    // Save the new authenticator
    await prisma.authenticators.create({
      data: {
        userId: session.user.id,
        credentialID: Buffer.from(credentialID).toString('base64url'),
        providerAccountId: session.user.id,
        credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64'),
        counter,
        credentialDeviceType: 'passkey',
        credentialBackedUp: false,
        transports: response.response.transports?.join(','),
        name: name || null,
      },
    });

    // Clear cookies
    cookieStore.delete('webauthn-add-challenge');
    cookieStore.delete('webauthn-add-name');

    return NextResponse.json({
      success: true,
      message: 'Passkey added successfully',
    });
  } catch (error) {
    console.error('Add passkey verification error:', error);
    return NextResponse.json({ error: 'Failed to verify registration' }, { status: 500 });
  }
}
