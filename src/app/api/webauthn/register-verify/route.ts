import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";

const rpID = process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "") ?? "localhost";
const origin = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const { email, response, challenge } = await req.json() as {
      email: string;
      response: RegistrationResponseJSON;
      challenge: string;
    };

    if (!email || !response || !challenge) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify the registration response
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 }
      );
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

    // Create or update user
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: email.split("@")[0],
      },
      update: {},
    });

    // Save authenticator
    await prisma.authenticators.create({
      data: {
        userId: user.id,
        credentialID: Buffer.from(credentialID).toString("base64url"),
        providerAccountId: user.id,
        credentialPublicKey: Buffer.from(credentialPublicKey).toString("base64"),
        counter,
        credentialDeviceType: "passkey",
        credentialBackedUp: false,
        transports: response.response.transports?.join(","),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Passkey registered successfully",
    });
  } catch (error) {
    console.error("Registration verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify registration" },
      { status: 500 }
    );
  }
}
