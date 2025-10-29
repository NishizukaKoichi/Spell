"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

interface Cast {
  id: string;
  status: string;
  createdAt: string;
  duration: number | null;
  costCents: number;
  errorMessage: string | null;
  artifactUrl: string | null;
  spell: {
    id: string;
    name: string;
  };
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

export function CastListClient({ initialCasts }: { initialCasts: Cast[] }) {
  const [casts, setCasts] = useState<Cast[]>(initialCasts);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    // Check if any casts are in non-terminal state
    const hasActiveCasts = casts.some(
      (cast) => cast.status !== "completed" && cast.status !== "failed"
    );

    if (!hasActiveCasts) {
      return;
    }

    // Poll for updates every 3 seconds
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/casts");
        if (response.ok) {
          const data = await response.json();
          setCasts(data.casts);
        }
      } catch (error) {
        console.error("Error polling casts:", error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [casts]);

  const filteredCasts = useMemo(() => {
    let filtered = casts;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (cast) =>
          cast.spell.name.toLowerCase().includes(query) ||
          cast.id.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((cast) => cast.status === statusFilter);
    }

    return filtered;
  }, [casts, searchQuery, statusFilter]);

  if (casts.length === 0) {
    return (
      <Card className="border-white/10">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <p className="text-lg text-white/60 mb-4">
            No casts yet. Start by casting a spell!
          </p>
          <Link
            href="/"
            className="text-white/80 hover:text-white underline"
          >
            Browse Spells
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and filters */}
      <div className="flex gap-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by spell name or cast ID..."
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-white text-black/5 border-white/10">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      {(searchQuery || statusFilter !== "all") && (
        <div className="text-sm text-white/60">
          Found {filteredCasts.length} cast{filteredCasts.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Cast list */}
      {filteredCasts.length === 0 ? (
        <Card className="border-white/10">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-white/60">No casts found matching your criteria</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCasts.map((cast) => (
        <Link key={cast.id} href={`/casts/${cast.id}`}>
          <Card className="border-white/10 hover:border-white/20 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(cast.status)}
                    <span className="text-xl font-semibold hover:text-white/80 transition-colors">
                      {cast.spell.name}
                    </span>
                    <Badge variant={getStatusBadgeVariant(cast.status)}>
                      {cast.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-white/60">Cast ID: {cast.id}</p>
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
                      className="ml-2 text-white/80 hover:text-white underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
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
    </div>
  );
}
