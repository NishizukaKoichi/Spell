"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface CastButtonProps {
  spellId: string;
  priceAmount?: number;
}

export function CastButton({ spellId, priceAmount = 0 }: CastButtonProps) {
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  const handleCast = async () => {
    if (!session) {
      router.push("/auth/signin");
      return;
    }

    setLoading(true);

    try {
      // If spell requires payment, redirect to Stripe checkout
      if (priceAmount > 0) {
        const checkoutResponse = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ spellId }),
        });

        if (!checkoutResponse.ok) {
          const error = await checkoutResponse.json();
          throw new Error(error.error || "Failed to create checkout session");
        }

        const { url } = await checkoutResponse.json();
        window.location.href = url;
        return;
      }

      // For free spells, cast directly
      const response = await fetch("/api/cast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spellId,
          input: {},
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Failed to cast spell");
        return;
      }

      const data = await response.json();
      alert(`Cast initiated! Cast ID: ${data.cast.id}`);
      router.push("/casts");
    } catch (error) {
      console.error("Cast error:", error);
      alert("Failed to cast spell");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="lg"
      onClick={handleCast}
      disabled={loading}
      className="gap-2 bg-purple-600 hover:bg-purple-700"
    >
      <Zap className="h-5 w-5" />
      {loading
        ? "Processing..."
        : priceAmount > 0
          ? `Cast for $${(priceAmount / 100).toFixed(2)}`
          : "Cast Spell"}
    </Button>
  );
}
