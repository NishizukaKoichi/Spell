import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";

// WebAuthn Configuration
const rpName = "Spell Platform";
const rpID = process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "") ?? "localhost";
const origin = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      id: "webauthn",
      name: "Passkey",
      credentials: {
        response: { type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.response) {
          return null;
        }

        try {
          const response = JSON.parse(credentials.response as string) as AuthenticationResponseJSON;

          // Find authenticator by credential ID
          const authenticator = await prisma.authenticators.findUnique({
            where: { credentialID: response.id },
            include: { users: true },
          });

          if (!authenticator) {
            return null;
          }

          // Verify the authentication response
          const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: "", // TODO: Get from session storage
            expectedOrigin: origin,
            expectedRPID: rpID,
            authenticator: {
              credentialID: Buffer.from(authenticator.credentialID, "base64url"),
              credentialPublicKey: Buffer.from(authenticator.credentialPublicKey, "base64"),
              counter: authenticator.counter,
            },
          });

          if (!verification.verified) {
            return null;
          }

          // Update counter
          await prisma.authenticators.update({
            where: { credentialID: authenticator.credentialID },
            data: { counter: verification.authenticationInfo.newCounter },
          });

          return {
            id: authenticator.users.id,
            email: authenticator.users.email,
            name: authenticator.users.name,
          };
        } catch (error) {
          console.error("WebAuthn authentication error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
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
