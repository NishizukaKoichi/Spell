import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import type { NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import { cookies } from 'next/headers';

const rpID = process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '') ?? 'localhost';
const origin = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      id: 'webauthn',
      name: 'Passkey',
      credentials: {
        response: { type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.response) {
          return null;
        }

        try {
          const response = JSON.parse(credentials.response as string) as AuthenticationResponseJSON;

          // Retrieve challenge from secure HTTP-only cookie
          const cookieStore = await cookies();
          const challenge = cookieStore.get('webauthn-challenge')?.value;

          if (!challenge) {
            console.error('WebAuthn challenge not found or expired');
            return null;
          }

          // Find authenticator by credential ID
          const authenticator = await prisma.authenticators.findUnique({
            where: { credentialID: response.id },
            include: { users: true },
          });

          if (!authenticator) {
            return null;
          }

          // Verify the authentication response with challenge from cookie
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
            return null;
          }

          // Update counter and lastUsedAt
          await prisma.authenticators.update({
            where: { credentialID: authenticator.credentialID },
            data: {
              counter: verification.authenticationInfo.newCounter,
              lastUsedAt: new Date(),
            },
          });

          // Clear the challenge cookie after successful verification
          cookieStore.delete('webauthn-challenge');

          return {
            id: authenticator.users.id,
            email: authenticator.users.email,
            name: authenticator.users.name,
          };
        } catch (error) {
          console.error('WebAuthn authentication error:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
