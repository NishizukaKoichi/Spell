"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className={`transition-opacity duration-700 ${isVisible ? "opacity-100" : "opacity-0"}`}>
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%E3%82%B9%E3%82%AF%E3%83%AA%E3%83%BC%E3%83%B3%E3%82%B7%E3%83%A7%E3%83%83%E3%83%88%202025-10-30%20%E5%8D%88%E5%BE%8C12.13.39-eupNehpDABm2UAm9e9HIZcUXCRYGkK.png"
          alt="ロゴ"
          width={300}
          height={300}
          className="h-auto w-32 md:w-40"
          priority
        />
      </div>
    </div>
  )
}
