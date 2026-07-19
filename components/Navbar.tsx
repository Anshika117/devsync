"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

export default function Navbar() {
  const pathname = usePathname()
  // Logged-out landing page — a nav bar full of links to authenticated
  // pages (which would just bounce back to /login anyway) doesn't belong
  // above a login/register card.
  if (pathname === "/login") return null

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-8 py-4 flex items-center justify-between">
      <Link href="/dashboard" className="text-white font-bold text-xl">
        DevSync
      </Link>
      <div className="flex gap-6">
        <Link href="/dashboard" className="text-gray-400 hover:text-white transition text-sm">Dashboard</Link>
        <Link href="/goals" className="text-gray-400 hover:text-white transition text-sm">Goals</Link>
        <Link href="/profile" className="text-gray-400 hover:text-white transition text-sm">Profile</Link>
        <Link href="/settings" className="text-gray-400 hover:text-white transition text-sm">Settings</Link>
      </div>
    </nav>
  )
}