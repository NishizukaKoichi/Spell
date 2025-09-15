"use client"

import { ShoppingBag, BookOpen, Users } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const tabs = [
  { name: "Bazaar", href: "/bazaar", icon: ShoppingBag, label: "Bazaar" },
  { name: "Grimoire", href: "/grimoire", icon: BookOpen, label: "Grimoire" },
  { name: "Wizards", href: "/wizards", icon: Users, label: "Wizards" },
]

export function AppStoreTabBar() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-50">
      <div className="flex items-center justify-around py-2 px-2 sm:px-4 max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || (pathname.startsWith(tab.href) && tab.href !== "/")
          const Icon = tab.icon

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-2 sm:px-3 rounded-lg transition-colors min-w-0 flex-1",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs font-medium truncate">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
