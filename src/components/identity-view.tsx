"use client"

import { useState } from "react"
import { ScrollArea } from "./ui/scroll-area"
import {
  KeyRound,
  Key,
  Link2,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Shield,
  Calendar,
  AlertTriangle,
  Smartphone,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Badge } from "./ui/badge"
import { useToast } from "@/hooks/use-toast"
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
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"
import { useLanguage } from "@/lib/i18n/language-provider"

interface Passkey {
  id: string
  name: string
  createdAt: string
  lastUsed?: string
  device: string
}

interface ApiKey {
  id: string
  name: string
  key: string
  createdAt: string
  lastUsed?: string
  permissions: string[]
}

interface LinkedAccount {
  id: string
  provider: string
  accountName: string
  linkedAt: string
  status: "active" | "expired"
  permissions: string[]
}

export function IdentityView() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"passkeys" | "apikeys" | "linked">("passkeys")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [newPasskeyName, setNewPasskeyName] = useState("")
  const [isAddingPasskey, setIsAddingPasskey] = useState(false)

  const [passkeys, setPasskeys] = useState<Passkey[]>([
    {
      id: "pk-001",
      name: "MacBook Pro",
      createdAt: "2024-01-10T10:00:00Z",
      lastUsed: "2024-01-14T15:30:00Z",
      device: "macOS Safari",
    },
    {
      id: "pk-002",
      name: "iPhone 15",
      createdAt: "2024-01-05T14:20:00Z",
      lastUsed: "2024-01-13T09:15:00Z",
      device: "iOS Safari",
    },
  ])

  const [apiKeys] = useState<ApiKey[]>([
    {
      id: "ak-001",
      name: "Production API",
      key: "spell_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      createdAt: "2024-01-01T00:00:00Z",
      lastUsed: "2024-01-14T12:00:00Z",
      permissions: ["read", "write", "execute"],
    },
    {
      id: "ak-002",
      name: "Development API",
      key: "spell_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      createdAt: "2023-12-15T10:30:00Z",
      lastUsed: "2024-01-13T16:45:00Z",
      permissions: ["read", "execute"],
    },
  ])

  const [linkedAccounts] = useState<LinkedAccount[]>([
    {
      id: "la-001",
      provider: "GitHub",
      accountName: "wizard_caster",
      linkedAt: "2024-01-01T00:00:00Z",
      status: "active",
      permissions: ["repo", "user"],
    },
    {
      id: "la-002",
      provider: "Google",
      accountName: "caster@example.com",
      linkedAt: "2023-12-20T10:00:00Z",
      status: "active",
      permissions: ["email", "profile"],
    },
  ])

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(keyId)) {
        newSet.delete(keyId)
      } else {
        newSet.add(keyId)
      }
      return newSet
    })
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
      duration: 2000,
    })
  }

  const maskApiKey = (key: string) => {
    if (key.length <= 12) return "••••••••••••"
    return key.slice(0, 8) + "••••••••••••" + key.slice(-4)
  }

  const handleDelete = () => {
    if (activeTab === "passkeys" && passkeys.length <= 1) {
      toast({
        title: t.identity.cannotDelete,
        description: t.identity.mustKeepOnePasskey,
        variant: "destructive",
        duration: 3000,
      })
      setShowDeleteDialog(false)
      setSelectedItem(null)
      return
    }

    if (activeTab === "passkeys") {
      setPasskeys((prev) => prev.filter((pk) => pk.id !== selectedItem?.id))
    }

    toast({
      title: t.identity.deleted,
      description: `${selectedItem?.name || "Item"} ${t.identity.itemDeleted}`,
      duration: 2000,
    })
    setShowDeleteDialog(false)
    setSelectedItem(null)
  }

  const handleAddPasskey = async () => {
    if (!newPasskeyName.trim()) {
      toast({
        title: t.identity.error,
        description: "Please enter a device name",
        variant: "destructive",
        duration: 2000,
      })
      return
    }

    setIsAddingPasskey(true)

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const newPasskey: Passkey = {
        id: `pk-${Date.now()}`,
        name: newPasskeyName,
        createdAt: new Date().toISOString(),
        device: navigator.userAgent.includes("Mac") ? "macOS Safari" : "Windows Chrome",
      }

      setPasskeys((prev) => [...prev, newPasskey])

      toast({
        title: t.identity.passkeyAdded,
        description: `${newPasskeyName} ${t.identity.passkeyAddedDesc}`,
        duration: 3000,
      })

      setShowAddDialog(false)
      setNewPasskeyName("")
    } catch {
      toast({
        title: t.identity.error,
        description: t.identity.failedToAddPasskey,
        variant: "destructive",
        duration: 3000,
      })
    } finally {
      setIsAddingPasskey(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="sticky top-12 z-40 border-b border-border/50 bg-background p-2 sm:p-3">
        <div className="mx-auto max-w-6xl space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t.identity.title}</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">{t.identity.subtitle}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <Button
              variant={activeTab === "passkeys" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("passkeys")}
              className="gap-2"
            >
              <Shield className="h-4 w-4" />
              <span>{t.identity.passkeys}</span>
            </Button>
            <Button
              variant={activeTab === "apikeys" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("apikeys")}
              className="gap-2"
            >
              <Key className="h-4 w-4" />
              <span>{t.identity.apiKeys}</span>
            </Button>
            <Button
              variant={activeTab === "linked" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("linked")}
              className="gap-2"
            >
              <Link2 className="h-4 w-4" />
              <span>{t.identity.linkedAccounts}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="sticky top-[104px] z-30 border-b border-border bg-background p-2 sm:p-3 sm:top-[120px]">
        <div className="mx-auto max-w-6xl px-2 py-2 sm:px-3 sm:py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {activeTab === "passkeys" && `${passkeys.length} ${t.identity.passkeys.toLowerCase()}`}
              {activeTab === "apikeys" && `${apiKeys.length} ${t.identity.apiKeys}`}
              {activeTab === "linked" && `${linkedAccounts.length} ${t.identity.linkedAccounts.toLowerCase()}`}
            </div>
            <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              <span>{t.identity.add}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 scroll-smooth bg-background">
        <div className="mx-auto max-w-6xl space-y-2 p-2 sm:space-y-3 sm:p-3">
          {activeTab === "passkeys" && (
            <Alert className="border-blue-500/50 bg-blue-500/10">
              <Smartphone className="h-4 w-4 text-blue-500" />
              <AlertTitle className="text-blue-500">{t.identity.worksAcrossDevices}</AlertTitle>
              <AlertDescription className="text-blue-500/80">{t.identity.worksAcrossDevicesDesc}</AlertDescription>
            </Alert>
          )}

          {activeTab === "passkeys" && passkeys.length === 1 && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertTitle className="text-yellow-500">{t.identity.addBackupPasskey}</AlertTitle>
              <AlertDescription className="text-yellow-500/80">{t.identity.addBackupPasskeyDesc}</AlertDescription>
            </Alert>
          )}

          {/* Passkeys */}
          {activeTab === "passkeys" &&
            passkeys.map((passkey) => (
              <div
                key={passkey.id}
                className="group cursor-pointer rounded-lg border border-border/50 bg-card p-3 transition-all duration-200 hover:scale-[1.01] hover:border-primary/50 hover:bg-accent/50 sm:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-1 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <h3 className="font-semibold text-foreground">{passkey.name}</h3>
                      <p className="text-sm text-muted-foreground">{passkey.device}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {t.identity.created}: {new Date(passkey.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {passkey.lastUsed && (
                          <span>
                            {t.identity.lastUsed}: {new Date(passkey.lastUsed).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedItem(passkey)
                      setShowDeleteDialog(true)
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    disabled={passkeys.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

          {/* API Keys */}
          {activeTab === "apikeys" &&
            apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="group cursor-pointer rounded-lg border border-border/50 bg-card p-3 transition-all duration-200 hover:scale-[1.01] hover:border-primary/50 hover:bg-accent/50 sm:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-1 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Key className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{apiKey.name}</h3>
                        <div className="flex gap-1">
                          {apiKey.permissions.map((perm) => (
                            <Badge key={perm} variant="secondary" className="text-xs">
                              {perm}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                          {visibleKeys.has(apiKey.id) ? apiKey.key : maskApiKey(apiKey.key)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleKeyVisibility(apiKey.id)
                          }}
                          className="h-7 w-7"
                        >
                          {visibleKeys.has(apiKey.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            copyToClipboard(apiKey.key, "API key")
                          }}
                          className="h-7 w-7"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {t.identity.created}: {new Date(apiKey.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {apiKey.lastUsed && (
                          <span>
                            {t.identity.lastUsed}: {new Date(apiKey.lastUsed).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedItem(apiKey)
                      setShowDeleteDialog(true)
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

          {/* Linked Accounts */}
          {activeTab === "linked" &&
            linkedAccounts.map((account) => (
              <div
                key={account.id}
                className="group cursor-pointer rounded-lg border border-border/50 bg-card p-3 transition-all duration-200 hover:scale-[1.01] hover:border-primary/50 hover:bg-accent/50 sm:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-1 items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Link2 className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{account.provider}</h3>
                        <Badge variant={account.status === "active" ? "default" : "destructive"}>
                          {account.status === "active" ? "Active" : "Expired"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{account.accountName}</p>
                      <div className="flex flex-wrap gap-1">
                        {account.permissions.map((perm) => (
                          <Badge key={perm} variant="secondary" className="text-xs">
                            {perm}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {t.identity.linked}: {new Date(account.linkedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedItem(account)
                      setShowDeleteDialog(true)
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </ScrollArea>

      {/* Passkey Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent
          className="max-h-[85vh] overflow-y-auto sm:max-h-[90vh]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {activeTab === "passkeys" && t.identity.addNewPasskey}
              {activeTab === "apikeys" && t.identity.addNewApiKey}
              {activeTab === "linked" && t.identity.linkNewAccount}
            </DialogTitle>
            <DialogDescription>
              {activeTab === "passkeys" && t.identity.passkeyDesc}
              {activeTab === "apikeys" && t.identity.apiKeyDesc}
              {activeTab === "linked" && t.identity.linkedAccountDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {activeTab === "passkeys" && (
              <>
                <Alert className="border-blue-500/50 bg-blue-500/10">
                  <Smartphone className="h-4 w-4 text-blue-500" />
                  <AlertTitle className="text-blue-500">{t.identity.autoSyncsAcrossDevices}</AlertTitle>
                  <AlertDescription className="text-blue-500/80">{t.identity.autoSyncsDesc}</AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="passkey-name">{t.identity.deviceName}</Label>
                  <Input
                    id="passkey-name"
                    placeholder={t.identity.deviceNamePlaceholder}
                    value={newPasskeyName}
                    onChange={(e) => setNewPasskeyName(e.target.value)}
                    autoFocus={false}
                  />
                  <p className="text-xs text-muted-foreground">{t.identity.deviceNameHelp}</p>
                </div>
              </>
            )}
            {activeTab === "apikeys" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">{t.identity.name}</Label>
                  <Input id="name" placeholder={t.identity.namePlaceholder} />
                </div>
                <div className="space-y-2">
                  <Label>{t.identity.permissions}</Label>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">
                      read
                    </Badge>
                    <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">
                      write
                    </Badge>
                    <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">
                      execute
                    </Badge>
                  </div>
                </div>
              </>
            )}
            {activeTab === "linked" && (
              <div className="space-y-2">
                <Label htmlFor="name">{t.identity.name}</Label>
                <Input id="name" placeholder={t.identity.namePlaceholder} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={isAddingPasskey}>
              {t.identity.cancel}
            </Button>
            <Button
              onClick={() => {
                if (activeTab === "passkeys") {
                  handleAddPasskey()
                } else {
                  toast({
                    title: t.common.success,
                    description: "New item has been added",
                    duration: 2000,
                  })
                  setShowAddDialog(false)
                }
              }}
              disabled={isAddingPasskey}
            >
              {isAddingPasskey ? t.identity.adding : t.identity.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-background border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{t.identity.areYouSure}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {activeTab === "passkeys" && passkeys.length <= 1 ? (
                <span className="text-yellow-500">{t.identity.lastPasskeyWarning}</span>
              ) : (
                t.identity.deleteConfirmation
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>{t.identity.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t.identity.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
