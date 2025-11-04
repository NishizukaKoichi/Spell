"use client"

import type React from "react"

import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { ChatSidebar } from "./chat-sidebar"
import { ChatMessages } from "./chat-messages"
import { ChatInput } from "./chat-input"
import { BazaarMarketplace } from "./bazaar-marketplace"
import { TransactionsView } from "./transactions-view"
import { LicensesView } from "./licenses-view"
import { ArtifactsView } from "./artifacts-view"
import { IdentityView } from "./identity-view"
import { SettingsView } from "./settings-view" // Added import for SettingsView
import { BillingView } from "./billing-view" // Added import for BillingView
import { Button } from "./ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "./ui/tooltip"
import { AlignJustifyIcon, Play, X } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog"
import { ScrollArea } from "./ui/scroll-area"

interface SpellMetadata {
  name: string
  author: string
  description?: string
  category?: string
  createdAt?: string
  cost?: number
  artifactType?: string // Added artifactType to SpellMetadata
}

interface ExecutionResult {
  spellName: string
  timestamp: string
  response: string
  ui?: React.ReactNode
}

interface SelectedItem {
  type: string
  name: string
  data?: any
}

export function ChatInterface() {
  const { toast } = useToast() // Initialize toast hook
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedSpell, setSelectedSpell] = useState<SpellMetadata | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingSpellContent, setPendingSpellContent] = useState("")
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const handleExecuteSpell = (content: string) => {
    if (selectedSpell && selectedSpell.cost && selectedSpell.cost > 0) {
      setPendingSpellContent(content)
      setShowConfirmDialog(true)
    } else {
      executeSpell(content)
    }
  }

  const executeSpell = (content: string) => {
    console.log("[v0] Executing spell:", content)
    const result: ExecutionResult = {
      spellName: selectedSpell?.name || content,
      timestamp: new Date().toISOString(),
      response: "Spell execution completed successfully. This is a sample response from the spell execution.",
      ui: (
        <div className="space-y-4">
          <div className="rounded-lg border border-white/20 bg-white/5 p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Execution Output</h3>
            <p className="text-white/80">Sample UI output from spell execution...</p>
          </div>
        </div>
      ),
    }
    setExecutionResult(result)

    // Check if the selected spell has artifactType (generates an artifact)
    if (selectedSpell && selectedSpell.artifactType) {
      toast({
        title: "Artifact saved successfully",
        description: `${selectedSpell.name} has been saved to Artifacts`,
        duration: 5000,
        className: "cursor-pointer",
        onClick: () => {
          // Navigate to Artifacts view when toast is clicked
          handleItemSelect({ type: "vaults", name: "Artifacts" })
        },
      })
    }
  }

  const handleConfirmExecute = () => {
    executeSpell(pendingSpellContent)
    setShowConfirmDialog(false)
    setPendingSpellContent("")
  }

  const handleCancelExecute = () => {
    setShowConfirmDialog(false)
    setPendingSpellContent("")
  }

  const handleSpellSelect = (spell: SpellMetadata) => {
    setSelectedSpell(spell)
  }

  const handleItemSelect = (item: SelectedItem) => {
    console.log("[v0] Item selected:", item)
    setSelectedItem(item)
    // モバイルでサイドバーを閉じる
    if (window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }

  const handleOpenPreview = () => {
    if (executionResult) {
      setShowPreview(true)
    }
  }

  return (
    <div className="flex h-screen bg-background dark">
      <ChatSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onItemSelect={handleItemSelect} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:bg-transparent"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Header - Responsive padding and button sizes */}
        <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border/50 bg-background px-3 py-2 sm:px-4 sm:py-3">
          {/* Tooltip for sidebar toggle button */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="h-9 w-9 text-foreground hover:bg-accent sm:h-10 sm:w-10"
                >
                  <AlignJustifyIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{sidebarOpen ? "Close" : "Open"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex-1" />
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleOpenPreview}
                  disabled={!executionResult}
                  className="h-9 w-9 text-foreground hover:bg-accent sm:h-10 sm:w-10 disabled:opacity-30"
                >
                  <Play className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{executionResult ? "View execution result" : "No execution result yet"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </header>

        {selectedItem?.type === "vaults" && selectedItem?.name === "Transactions" ? (
          <TransactionsView />
        ) : selectedItem?.type === "vaults" && selectedItem?.name === "Licenses" ? (
          <LicensesView />
        ) : selectedItem?.type === "vaults" && selectedItem?.name === "Artifacts" ? (
          <ArtifactsView />
        ) : selectedItem?.type === "bazaar" ? (
          <BazaarMarketplace mode="bazaar" />
        ) : selectedItem?.type === "grimoire" && selectedItem?.name === "All Spells" ? (
          <BazaarMarketplace mode="grimoire" />
        ) : selectedItem?.type === "grimoire" && selectedItem?.name === "Folders" ? (
          <BazaarMarketplace mode="folders" />
        ) : selectedItem?.type === "grimoire" && selectedItem?.name === "Bookmarks" ? (
          <BazaarMarketplace mode="bookmarks" />
        ) : selectedItem?.type === "caster" && selectedItem?.name === "Identity" ? (
          <IdentityView />
        ) : selectedItem?.type === "caster" && selectedItem?.name === "Settings" ? (
          <SettingsView />
        ) : selectedItem?.type === "caster" && selectedItem?.name === "Billing" ? (
          <BillingView />
        ) : (
          <>
            <ChatMessages selectedSpell={selectedSpell} selectedItem={selectedItem} />
            <ChatInput onSendMessage={handleExecuteSpell} onSpellSelect={handleSpellSelect} />
          </>
        )}
      </div>

      {showPreview && executionResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="relative h-[90vh] w-[90vw] max-w-6xl rounded-lg border-2 border-white bg-black p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">{executionResult.spellName}</h2>
                <p className="text-sm text-white/60">
                  Executed at {new Date(executionResult.timestamp).toLocaleString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPreview(false)}
                className="h-8 w-8 text-white hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <ScrollArea className="h-[calc(100%-80px)]">
              <div className="space-y-4 text-white">
                <div className="rounded-lg border border-white/20 bg-white/5 p-4">
                  <h3 className="mb-2 text-lg font-semibold">Response</h3>
                  <p className="text-white/80">{executionResult.response}</p>
                </div>
                {executionResult.ui && (
                  <div className="rounded-lg border border-white/20 bg-white/5 p-4">
                    <h3 className="mb-2 text-lg font-semibold">UI Output</h3>
                    {executionResult.ui}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="bg-black border-2 border-white text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirm Spell Execution</AlertDialogTitle>
            <AlertDialogDescription className="text-white/80">
              This spell costs {selectedSpell?.cost} credits. Do you want to proceed with the execution?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancelExecute}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              No
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExecute} className="bg-white text-black hover:bg-white/90">
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
