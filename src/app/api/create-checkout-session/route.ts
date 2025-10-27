import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { spellId } = await req.json();

    if (!spellId) {
      return NextResponse.json(
        { error: "spellId is required" },
        { status: 400 }
      );
    }

    // Get spell details
    const spell = await prisma.spell.findUnique({
      where: { id: spellId },
    });

    if (!spell) {
      return NextResponse.json({ error: "Spell not found" }, { status: 404 });
    }

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: spell.priceCurrency.toLowerCase(),
            product_data: {
              name: spell.name,
              description: spell.description,
            },
            unit_amount: spell.priceAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        spellId: spell.id,
        userId: session.user.id,
      },
      success_url: `${process.env.NEXTAUTH_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/spells/${spell.id}?payment=cancelled`,
      customer_email: session.user.email,
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error("Checkout session error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
