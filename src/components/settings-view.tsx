"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { ScrollArea } from "./ui/scroll-area"
import { Settings, User, Upload } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { useLanguage, type Language } from "@/lib/i18n/language-provider"

export function SettingsView() {
  const { toast } = useToast()
  const { language, setLanguage, t } = useLanguage()
  const [displayName, setDisplayName] = useState("Arcane Wizard")
  const [avatarUrl, setAvatarUrl] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const savedName = localStorage.getItem("caster_profile_name")
    const savedAvatar = localStorage.getItem("caster_profile_avatar")

    if (savedName) {
      setDisplayName(savedName)
    }
    if (savedAvatar) {
      setAvatarUrl(savedAvatar)
    }
  }, [])

  const handleAvatarChange = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid File",
          description: "Please select an image file",
          variant: "destructive",
          duration: 3000,
        })
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive",
          duration: 3000,
        })
        return
      }

      // Read and preview the image
      const reader = new FileReader()
      reader.onload = (event) => {
        setAvatarUrl(event.target?.result as string)
        toast({
          title: "Avatar Updated",
          description: "Your profile image has been changed",
          duration: 3000,
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = () => {
    localStorage.setItem("caster_profile_name", displayName)
    localStorage.setItem("caster_profile_avatar", avatarUrl)

    toast({
      title: t.settings.changesSaved.split(" ")[0],
      description: t.settings.changesSaved,
      duration: 3000,
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-12 z-40 border-b border-border/50 bg-background p-2 sm:p-3">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">{t.settings.title}</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">{t.settings.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 scroll-smooth bg-background">
        <div className="mx-auto max-w-6xl space-y-2 p-2 sm:space-y-3 sm:p-3">
          <div className="rounded-lg border border-border/50 bg-card/50 p-4 transition-all duration-200 hover:scale-[1.01] hover:border-primary/50 sm:p-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t.settings.profile}</h2>
              </div>

              <div className="flex items-center gap-4">
                <div className="group relative cursor-pointer" onClick={handleAvatarChange}>
                  <Avatar className="h-20 w-20 border-2 border-border/50 transition-all group-hover:border-primary/50">
                    <AvatarImage src={avatarUrl || "/placeholder.svg"} />
                    <AvatarFallback className="bg-primary/10 text-foreground">
                      <User className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Upload className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">{t.settings.avatar}</p>
                  <p className="text-xs text-muted-foreground">{t.settings.clickToUpload}</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>

              <div className="h-px bg-border/50" />

              <div className="space-y-2">
                <Label htmlFor="display-name" className="text-foreground">
                  {t.settings.name}
                </Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  className="bg-background text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language" className="text-foreground">
                  {t.settings.language}
                </Label>
                <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
                  <SelectTrigger id="language" className="bg-background text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background text-foreground">
                    <SelectItem value="en" className="text-foreground">
                      English
                    </SelectItem>
                    <SelectItem value="ja" className="text-foreground">
                      日本語
                    </SelectItem>
                    <SelectItem value="zh-CN" className="text-foreground">
                      简体中文
                    </SelectItem>
                    <SelectItem value="es" className="text-foreground">
                      Español
                    </SelectItem>
                    <SelectItem value="fr" className="text-foreground">
                      Français
                    </SelectItem>
                    <SelectItem value="de" className="text-foreground">
                      Deutsch
                    </SelectItem>
                    <SelectItem value="ko" className="text-foreground">
                      한국어
                    </SelectItem>
                    <SelectItem value="pt" className="text-foreground">
                      Português
                    </SelectItem>
                    <SelectItem value="ru" className="text-foreground">
                      Русский
                    </SelectItem>
                    <SelectItem value="it" className="text-foreground">
                      Italiano
                    </SelectItem>
                    <SelectItem value="ar" className="text-foreground">
                      العربية
                    </SelectItem>
                    <SelectItem value="hi" className="text-foreground">
                      हिन्दी
                    </SelectItem>
                    <SelectItem value="tr" className="text-foreground">
                      Türkçe
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t.settings.selectLanguage}</p>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} className="gap-2">
                  <Settings className="h-4 w-4" />
                  {t.settings.saveChanges}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
