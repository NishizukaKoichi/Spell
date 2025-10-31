import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

const rpID = process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '') ?? 'localhost';

export async function POST(req: NextRequest) {
  try {
    // Support both email-based and email-less authentication
    const body = await req.json().catch(() => ({}));
    const email = body.email;

    let user;
    let authenticators: Array<{ credentialID: string; transports: string | null }> = [];

    if (email && typeof email === 'string') {
      // Email-based authentication (for returning users who know their email)
      user = await prisma.user.findUnique({
        where: { email },
        include: { authenticators: true },
      });

      if (!user || user.authenticators.length === 0) {
        return NextResponse.json({ error: 'No passkeys found for this email' }, { status: 404 });
      }

      authenticators = user.authenticators;
    } else {
      // Email-less authentication (for discoverable credentials/resident keys)
      // This allows users to authenticate without entering email
      // The browser will show available passkeys for this domain
      authenticators = [];
    }

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: authenticators.map(
        (auth: { credentialID: string; transports: string | null }) => ({
          id: Buffer.from(auth.credentialID, 'base64url'),
          type: 'public-key' as const,
          transports: auth.transports?.split(',') as AuthenticatorTransport[] | undefined,
        })
      ),
      userVerification: 'preferred',
    });

    // Store challenge in secure HTTP-only cookie for verification
    const cookieStore = await cookies();
    cookieStore.set('webauthn-challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 5, // 5 minutes
      path: '/',
    });

    return NextResponse.json({ options });
  } catch (error) {
    console.error('Authentication options error:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}
