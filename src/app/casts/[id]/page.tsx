import { DashboardLayout } from "@/components/dashboard-layout";
import { CastDetailClient } from "@/components/cast-detail-client";
import { auth } from "@/lib/auth/config";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

async function getCast(id: string) {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/casts/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export default async function CastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const cast = await getCast(id);

  if (!cast) {
    notFound();
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Link
          href="/casts"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Cast History
        </Link>

        {/* Cast Detail with Real-time Updates */}
        <CastDetailClient initialCast={cast} />
      </div>
    </DashboardLayout>
  );
}
