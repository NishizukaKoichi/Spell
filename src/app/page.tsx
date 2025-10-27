import { DashboardLayout } from "@/components/dashboard-layout";
import { SpellCard } from "@/components/spell-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

// Mock data for demonstration
const mockSpells = [
  {
    id: "1",
    key: "image-resize",
    name: "Image Resizer",
    description: "Resize images to any dimension with high quality",
    longDescription: null,
    version: "1.0.0",
    priceModel: "metered",
    priceAmount: 50,
    priceCurrency: "USD",
    executionMode: "workflow",
    tags: ["image", "resize", "utility"],
    category: "Image Processing",
    rating: 4.5,
    totalCasts: 1234,
    inputSchema: null,
    outputSchema: null,
    authorId: "author1",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    key: "pdf-converter",
    name: "PDF Converter",
    description: "Convert documents to PDF format",
    longDescription: null,
    version: "1.0.0",
    priceModel: "one_time",
    priceAmount: 299,
    priceCurrency: "USD",
    executionMode: "workflow",
    tags: ["pdf", "converter", "document"],
    category: "Document Processing",
    rating: 4.8,
    totalCasts: 5678,
    inputSchema: null,
    outputSchema: null,
    authorId: "author2",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export default function Home() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Spell Marketplace</h1>
          <p className="text-white/60">
            Discover and cast powerful spells for your workflows
          </p>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              placeholder="Search spells..."
              className="pl-10 bg-white/5 border-white/10"
            />
          </div>
          <Button variant="outline">Filters</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockSpells.map((spell) => (
            <SpellCard key={spell.id} spell={spell} />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
