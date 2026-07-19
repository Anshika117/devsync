"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { toast } from "sonner"

type Mode = "login" | "register"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleGoogle() {
    await signIn("google", { callbackUrl: "/dashboard" })
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      toast.error("Enter your email and password.")
      return
    }
    setLoading(true)
    const res = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)
    if (!res || res.error) {
      toast.error("Incorrect email or password.")
      return
    }
    router.push("/dashboard")
  }

  async function handleRegister() {
    if (!email.trim() || !password) {
      toast.error("Enter your email and password.")
      return
    }
    setLoading(true)
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setLoading(false)
      toast.error(data.error || "Registration failed.")
      return
    }

    // Account created — log straight in with the same credentials rather
    // than making them re-type everything on a separate login step.
    const signInRes = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)
    if (!signInRes || signInRes.error) {
      toast.success("Account created — please log in.")
      setMode("login")
      setPassword("")
      return
    }
    router.push("/dashboard")
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return
    if (mode === "login") handleLogin()
    else handleRegister()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 p-8 rounded-2xl shadow-xl flex flex-col gap-6 w-full max-w-sm">
        <div>
          <h1 className="text-2xl font-bold text-white text-center">Welcome to DevSync</h1>
          <p className="text-gray-400 text-sm text-center mt-1">
            Your AI-powered DSA tracker for FAANG prep
          </p>
        </div>

        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition cursor-pointer ${
              mode === "login" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition cursor-pointer ${
              mode === "register" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Register
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {mode === "register" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Name"
              className="bg-gray-800 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Email"
            type="email"
            autoComplete="email"
            className="bg-gray-800 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="bg-gray-800 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
          <button
            type="button"
            onClick={mode === "login" ? handleLogin : handleRegister}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition text-sm cursor-pointer"
          >
            {loading ? "..." : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px bg-gray-800 flex-1" />
          <span className="text-xs text-gray-500">OR</span>
          <div className="h-px bg-gray-800 flex-1" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          className="w-full bg-white text-gray-900 font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-100 transition cursor-pointer"
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.5 33.1 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-9 20-20 0-1.3-.1-2.7-.4-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.5 35.5 26.9 36 24 36c-5.1 0-9.4-2.9-11.3-7.1l-6.6 4.8C9.8 39.8 16.4 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.6-4.8 6l6.2 5.2C40.7 35.5 44 30.1 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  )
}
