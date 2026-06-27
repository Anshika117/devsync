import Link from "next/link"

export default function Navbar() {
  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-8 py-4 flex items-center justify-between">
      <Link href="/dashboard" className="text-white font-bold text-xl">
        DevSync
      </Link>
      <div className="flex gap-6">
        <Link href="/dashboard" className="text-gray-400 hover:text-white transition text-sm">Dashboard</Link>
        <Link href="/profile" className="text-gray-400 hover:text-white transition text-sm">Profile</Link>
      </div>
    </nav>
  )
}