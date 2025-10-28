import { DashboardLayout } from "@/components/dashboard-layout";
import { CastListClient } from "@/components/cast-list-client";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

async function getCasts() {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/casts`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return { casts: [], pagination: { total: 0 } };
  }

  return res.json();
}

export default async function CastsPage() {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  const { casts, pagination } = await getCasts();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Cast History</h1>
          <p className="text-white/60">
            View all your spell executions and their results
          </p>
        </div>

        <CastListClient initialCasts={casts} />

        {pagination.total > 0 && (
          <div className="text-center text-sm text-white/60">
            Showing {casts.length} of {pagination.total} casts
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
