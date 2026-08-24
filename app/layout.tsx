import type { Metadata, Viewport } from "next"
import { Noto_Serif_SC, Noto_Sans_SC } from "next/font/google"
import "./globals.css"

const notoSerif = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-noto-serif",
})

const notoSans = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-noto-sans",
})

export const metadata: Metadata = {
  title: "故事画布 · Story Canvas",
  description: "维度与元素的创作画布 —— 吸收、积累、投影",
}

export const viewport: Viewport = {
  themeColor: "#f7f4ee",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" className={`bg-background ${notoSerif.variable} ${notoSans.variable}`}>
      <body className="overflow-hidden">{children}</body>
    </html>
  )
}
