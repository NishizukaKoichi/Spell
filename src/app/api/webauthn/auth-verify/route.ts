import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";

const rpID = process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "") ?? "localhost";
const origin = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const { email, response, challenge } = (await req.json()) as {
      email: string;
      response: AuthenticationResponseJSON;
      challenge: string;
    };

    if (!email || !response || !challenge) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find user and authenticator
    const user = await prisma.user.findUnique({
      where: { email },
      include: { authenticators: true },
    });

    if (!user || user.authenticators.length === 0) {
      return NextResponse.json(
        { error: "No passkeys found for this email" },
        { status: 404 }
      );
    }

    // Find the authenticator used for this authentication
    const authenticator = user.authenticators.find(
      (auth) =>
        Buffer.from(auth.credentialID, "base64url").toString("base64url") ===
        response.id
    );

    if (!authenticator) {
      return NextResponse.json(
        { error: "Authenticator not found" },
        { status: 404 }
      );
    }

    // Verify the authentication response
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(authenticator.credentialID, "base64url"),
        credentialPublicKey: Buffer.from(
          authenticator.credentialPublicKey,
          "base64"
        ),
        counter: authenticator.counter,
      },
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 400 }
      );
    }

    // Update authenticator counter
    await prisma.authenticators.update({
      where: {
        userId_credentialID: {
          userId: user.id,
          credentialID: authenticator.credentialID,
        },
      },
      data: {
        counter: verification.authenticationInfo.newCounter,
      },
    });

    // TODO: Create session using NextAuth
    // For now, return success
    return NextResponse.json({
      success: true,
      message: "Authentication successful",
      userId: user.id,
    });
  } catch (error) {
    console.error("Authentication verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify authentication" },
      { status: 500 }
    );
  }
}
