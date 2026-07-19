import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT sessions instead of database sessions: avoids a Session-table lookup
  // on every single request. The adapter is still used for OAuth account
  // linking (so Google login still creates/links the User row correctly) —
  // only session validation moves from a DB query to signature verification.
  // Tradeoff: a session can no longer be killed instantly server-side (no row
  // to delete); it stays valid until it expires. See DECISIONS.md.
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    // Email/password sign-in. Account creation itself happens in
    // /api/auth/register (which hashes the password and writes the User row
    // directly) — this provider only ever verifies existing credentials, it
    // never creates a user. That keeps it decoupled from the PrismaAdapter
    // above, which is still the one responsible for Google account linking.
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : ""
        const password = typeof credentials?.password === "string" ? credentials.password : ""
        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        // Either no account with this email, or it's a Google-only account
        // that never set a password — reject both the same way rather than
        // distinguishing, so a login attempt can't be used to probe which
        // emails exist in the system.
        if (!user?.password) return null

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name, image: user.image }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // On sign-in, `user` is the freshly created/looked-up DB row (via the
    // adapter) — stash its id on the token so it's available on every
    // subsequent request without a DB call.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string
      }
      return session
    }
  }
})