import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Navbar from "@/components/Navbar"
import AIAssistant from "@/components/AIAssistant"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DevSync",
  description: "Your AI-powered DSA tracker for FAANG prep",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        {children}
        <AIAssistant />
      </body>
    </html>
  )
}