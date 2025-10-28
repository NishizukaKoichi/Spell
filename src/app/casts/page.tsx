import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

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

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "running":
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    default:
      return <Clock className="h-5 w-5 text-yellow-500" />;
  }
}

function getStatusBadgeVariant(status: string): "default" | "outline" {
  return status === "completed" ? "default" : "outline";
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

        {casts.length === 0 ? (
          <Card className="border-white/10">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="text-lg text-white/60 mb-4">
                No casts yet. Start by casting a spell!
              </p>
              <Link
                href="/"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Browse Spells
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {casts.map((cast: any) => (
              <Link key={cast.id} href={`/casts/${cast.id}`}>
                <Card className="border-white/10 hover:border-white/20 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(cast.status)}
                          <span className="text-xl font-semibold hover:text-purple-400 transition-colors">
                            {cast.spell.name}
                          </span>
                          <Badge variant={getStatusBadgeVariant(cast.status)}>
                            {cast.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-white/60">
                          Cast ID: {cast.id}
                        </p>
                      </div>
                    <div className="text-right text-sm text-white/60">
                      <p>
                        {new Date(cast.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {cast.duration && (
                        <p className="mt-1">{cast.duration}ms duration</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-white/60">Cost:</span>
                      <span className="ml-2 font-mono">
                        ${(cast.costCents / 100).toFixed(2)}
                      </span>
                    </div>
                    {cast.artifactUrl && (
                      <div>
                        <span className="text-white/60">Result:</span>
                        <a
                          href={cast.artifactUrl}
                          className="ml-2 text-purple-400 hover:text-purple-300 underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View Output
                        </a>
                      </div>
                    )}
                    {cast.errorMessage && (
                      <div className="col-span-2">
                        <span className="text-white/60">Error:</span>
                        <span className="ml-2 text-red-400">
                          {cast.errorMessage}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {pagination.total > 0 && (
          <div className="text-center text-sm text-white/60">
            Showing {casts.length} of {pagination.total} casts
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
