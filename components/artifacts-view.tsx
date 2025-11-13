"use client"

import { useState } from "react"
import { ScrollArea } from "./ui/scroll-area"
import { Package, Calendar, User, Download, Shield, Scroll } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Button } from "./ui/button"
import { useLanguage } from "@/lib/i18n/language-provider"

interface Artifact {
  id: string
  name: string
  type: "App" | "Tool" | "Template"
  acquiredAt: string
  author: string
  version: string
  description?: string
  category: "Productivity" | "Creative" | "Analytics" | "Collaboration"
  signed: boolean
  redistributable: boolean
  image?: string // Added image field for consistency with Bazaar
  isNew?: boolean // Added isNew flag for newly acquired artifacts
}

export function ArtifactsView() {
  const { t } = useLanguage()
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null)
  const [viewedArtifacts, setViewedArtifacts] = useState<Set<string>>(new Set())

  const artifacts: Artifact[] = [
    {
      id: "art-001",
      name: "Data Analysis Eye",
      type: "App",
      acquiredAt: "2024-01-14T15:45:00Z",
      author: "Analytics Sorcerer",
      version: "2.3.0",
      description: "Standalone data visualization app. Deployable and redistributable.",
      category: "Analytics",
      signed: true,
      redistributable: true,
      image: "/data-analytics-eye-visualization.jpg",
      isNew: true, // Mark as newly acquired
    },
    {
      id: "art-002",
      name: "Automation Spirit",
      type: "App",
      acquiredAt: "2024-01-13T09:20:00Z",
      author: "Automation Mage",
      version: "1.0.0",
      description: "Reusable automation tool. Can be deployed independently.",
      category: "Productivity",
      signed: true,
      redistributable: true,
      image: "/automation-spirit-robot-assistant.jpg",
    },
    {
      id: "art-003",
      name: "Creative Flames",
      type: "Tool",
      acquiredAt: "2024-01-12T14:10:00Z",
      author: "Creative Wizard",
      version: "3.0.2",
      description: "Standalone creative app. Signed and ready for redistribution.",
      category: "Creative",
      signed: true,
      redistributable: true,
      image: "/creative-flames-fire-art.jpg",
    },
    {
      id: "art-004",
      name: "Communication Bridge",
      type: "Tool",
      acquiredAt: "2024-01-11T11:00:00Z",
      author: "Harmony Enchanter",
      version: "1.8.0",
      description: "Deployable collaboration app. Redistributable and signed.",
      category: "Collaboration",
      signed: true,
      redistributable: true,
    },
  ]

  const handleArtifactClick = (artifact: Artifact) => {
    setSelectedArtifact(artifact)
    if (artifact.isNew) {
      setViewedArtifacts((prev) => new Set(prev).add(artifact.id))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-12 z-40 border-b border-border/50 bg-background p-2 sm:p-3">
        <div className="mx-auto max-w-6xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t.artifacts.title}</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">{t.artifacts.description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-[88px] z-30 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-6xl px-2 py-2 sm:px-3 sm:py-3">
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="rounded-lg border border-border/50 bg-muted/30 p-2 sm:p-3">
              <p className="text-xs text-muted-foreground sm:text-sm">{t.artifacts.totalArtifacts}</p>
              <p className="text-lg font-bold text-foreground sm:text-2xl">{artifacts.length}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/30 p-2 sm:p-3">
              <p className="text-xs text-muted-foreground sm:text-sm">{t.artifacts.signedLabel}</p>
              <p className="text-lg font-bold text-green-500 sm:text-2xl">{artifacts.filter((a) => a.signed).length}</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 scroll-smooth bg-background">
        <div className="mx-auto max-w-6xl space-y-2 p-2 sm:space-y-3 sm:p-3">
          {artifacts.map((artifact) => (
            <div
              key={artifact.id}
              onClick={() => handleArtifactClick(artifact)}
              className={`group cursor-pointer rounded-lg border p-3 transition-all duration-200 hover:scale-[1.01] hover:border-primary/50 hover:bg-accent/50 sm:p-4 ${
                artifact.isNew && !viewedArtifacts.has(artifact.id)
                  ? "border-primary bg-primary/5"
                  : "border-border/50 bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-1 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                    {artifact.image ? (
                      <img
                        src={artifact.image || "/placeholder.svg"}
                        alt={artifact.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Scroll className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <h3 className="font-semibold text-foreground">{artifact.name}</h3>
                    {artifact.description && <p className="text-sm text-muted-foreground">{artifact.description}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground sm:gap-4 sm:text-sm">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{artifact.author}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(artifact.acquiredAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={!!selectedArtifact} onOpenChange={() => setSelectedArtifact(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedArtifact && (
                <>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                    {selectedArtifact.image ? (
                      <img
                        src={selectedArtifact.image || "/placeholder.svg"}
                        alt={selectedArtifact.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Scroll className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  {selectedArtifact.name}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedArtifact && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">{t.artifacts.descriptionLabel}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedArtifact.description || t.artifacts.noDescription}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t.artifacts.type}</p>
                  <p className="text-sm font-medium text-foreground">{selectedArtifact.type}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t.artifacts.versionLabel}</p>
                  <p className="text-sm font-medium text-foreground">{selectedArtifact.version}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t.artifacts.category}</p>
                  <p className="text-sm font-medium text-foreground">{selectedArtifact.category}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t.artifacts.author}</p>
                  <p className="text-sm font-medium text-foreground">{selectedArtifact.author}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t.artifacts.acquired}</p>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(selectedArtifact.acquiredAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t.artifacts.signedLabel}</p>
                  <div className="flex items-center gap-1">
                    {selectedArtifact.signed && <Shield className="h-3 w-3 text-green-500" />}
                    <p className="text-sm font-medium text-foreground">
                      {selectedArtifact.signed ? t.artifacts.yes : t.artifacts.no}
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t.artifacts.redistributable}</p>
                  <p className="text-sm font-medium text-foreground">
                    {selectedArtifact.redistributable ? t.artifacts.yes : t.artifacts.no}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">{t.artifacts.artifactId}</h3>
                <code className="block rounded bg-muted p-2 text-xs text-muted-foreground">{selectedArtifact.id}</code>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  {t.artifacts.install}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
