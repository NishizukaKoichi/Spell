"use client"

import { Button } from "./ui/button"
import { ScrollArea } from "./ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import {
  AlignJustifyIcon,
  WandSparklesIcon,
  Store,
  BookOpen,
  User,
  ChevronDown,
  ChevronRight,
  Folder,
  Bookmark,
  Activity,
  FileCheck,
  Package,
  FileTextIcon,
  KeyRound,
  Settings,
  CreditCard,
  Archive,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useLanguage } from "@/lib/i18n/language-provider"

interface ChatSidebarProps {
  isOpen: boolean
  onClose: () => void
  onItemSelect?: (item: { type: string; name: string; data?: any }) => void
}

export function ChatSidebar({ isOpen, onClose, onItemSelect }: ChatSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const { t } = useLanguage()

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]))
  }

  const handleItemClick = (type: string, name: string, data?: any) => {
    if (onItemSelect) {
      onItemSelect({ type, name, data })
    }
  }

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onClose} />}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-[240px] border-r border-sidebar-border bg-sidebar transition-transform duration-200 sm:w-56 md:w-64",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-sidebar-border p-2 sm:p-3">
            <div className="flex items-center">
              <img
                src="/images/design-mode/u8236695659_wizard_hat_and_staff_green_silhouette_minimal_fla_5034726e-a239-4a30-b7db-ac9700d56a78_2.png"
                alt="Product Logo"
                className="h-14 w-14 sm:h-[66px] sm:w-[66px]"
              />
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
                  >
                    <AlignJustifyIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Close</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <ScrollArea className="flex-1 px-1.5 py-2 sm:px-2 sm:py-3">
            <div className="space-y-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleItemClick("execution", "Execution")}
                className="w-full justify-start gap-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <WandSparklesIcon className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm sm:text-base">{t.sidebar.execution}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleItemClick("bazaar", "Bazaar")}
                className="w-full justify-start gap-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <Store className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm sm:text-base">{t.sidebar.bazaar}</span>
              </Button>

              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection("grimoire")}
                  className="w-full justify-start gap-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  {expandedSections.includes("grimoire") ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate text-sm sm:text-base">{t.sidebar.grimoire}</span>
                </Button>
                {expandedSections.includes("grimoire") && (
                  <div className="ml-6 mt-1 space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleItemClick("grimoire", "All Spells")}
                      className="w-full justify-start gap-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
                    >
                      <FileTextIcon className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
                      <span className="truncate text-sm sm:text-base">{t.sidebar.allSpells}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleItemClick("grimoire", "Folders")}
                      className="w-full justify-start gap-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
                    >
                      <Folder className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
                      <span className="truncate text-sm sm:text-base">{t.sidebar.folders}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleItemClick("grimoire", "Bookmarks")}
                      className="w-full justify-start gap-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
                    >
                      <Bookmark className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
                      <span className="truncate text-sm sm:text-base">{t.sidebar.bookmarks}</span>
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection("vaults")}
                  className="w-full justify-start gap-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  {expandedSections.includes("vaults") ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <Archive className="h-4 w-4 shrink-0" />
                  <span className="truncate text-sm sm:text-base">{t.sidebar.vaults}</span>
                </Button>
                {expandedSections.includes("vaults") && (
                  <div className="ml-6 mt-1 space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleItemClick("vaults", "Transactions")}
                      className="w-full justify-start gap-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
                    >
                      <Activity className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
                      <span className="truncate text-sm sm:text-base">{t.sidebar.transactions}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleItemClick("vaults", "Licenses")}
                      className="w-full justify-start gap-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
                    >
                      <FileCheck className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
                      <span className="truncate text-sm sm:text-base">{t.sidebar.licenses}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleItemClick("vaults", "Artifacts")}
                      className="w-full justify-start gap-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
                    >
                      <Package className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
                      <span className="truncate text-sm sm:text-base">{t.sidebar.artifacts}</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="border-t border-sidebar-border p-2 sm:p-3">
            <div className="relative">
              {expandedSections.includes("caster") && (
                <div className="absolute bottom-full left-0 right-0 mb-1 space-y-1 rounded-md border border-sidebar-border bg-sidebar p-1 shadow-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleItemClick("caster", "Identity", {
                        subtitle: "Passkeys / API Keys / Linked Accounts",
                      })
                    }
                    className="w-full justify-start gap-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
                  >
                    <KeyRound className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
                    <span className="truncate text-sm sm:text-base">{t.sidebar.identity}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleItemClick("caster", "Settings")}
                    className="w-full justify-start gap-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
                  >
                    <Settings className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
                    <span className="truncate text-sm sm:text-base">{t.sidebar.settings}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleItemClick("caster", "Billing")}
                    className="w-full justify-start gap-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
                  >
                    <CreditCard className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
                    <span className="truncate text-sm sm:text-base">{t.sidebar.billing}</span>
                  </Button>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection("caster")}
                className="w-full justify-start gap-2 text-left text-sidebar-foreground hover:bg-sidebar-accent"
              >
                {expandedSections.includes("caster") ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <User className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm sm:text-base">{t.sidebar.caster}</span>
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
