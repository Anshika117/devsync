import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

const BCRYPT_ROUNDS = 10
const MIN_PASSWORD_LENGTH = 8

// Creates a User row with a hashed password. This is the only place a
// password ever gets set — the Credentials provider in auth.ts (authorize())
// only ever reads and compares it, never writes it.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)

  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body?.password === "string" ? body.password : ""

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    )
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    // Covers both "already registered with a password" and "signed up via
    // Google" — either way, registering again here isn't the right path, so
    // the same message applies without needing to distinguish which case it is.
    return NextResponse.json(
      {
        error:
          "An account with this email already exists. Try logging in, or continue with Google if that's how you originally signed up.",
      },
      { status: 409 }
    )
  }

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS)
  await prisma.user.create({
    data: { email, name: name || null, password: hashed },
  })

  return NextResponse.json({ ok: true })
}
