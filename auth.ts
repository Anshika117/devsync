import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
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