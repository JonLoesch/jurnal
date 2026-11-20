import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { getDb } from "@/db/client";
import { accountExists, upsertAccount } from "@/server/journal";

// Local development only: a login form that needs no Google account. Never on in production.
const devLogin = process.env.AUTH_DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google] : []),
    ...(devLogin
      ? [
          Credentials({
            credentials: { email: {}, name: {} },
            async authorize(c) {
              const email = String(c?.email ?? "").trim();
              if (!email.includes("@")) return null;
              const a = await upsertAccount(getDb(), { email, name: String(c?.name ?? "") || email });
              return { id: a.id, email: a.email, name: a.name };
            },
          }),
        ]
      : []),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user && account?.provider !== "credentials") {
        // Google sign-in: map the Google identity to our account row (created on first sign-in).
        if (!user.email) return token;
        const a = await upsertAccount(getDb(), { email: user.email, name: user.name ?? user.email });
        token.accountId = a.id;
      } else if (user) {
        token.accountId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // A session left over from a deleted account (another device) counts as signed out.
      const live = token.accountId ? await accountExists(getDb(), token.accountId as string) : false;
      if (live) (session.user as { id?: string }).id = token.accountId as string;
      return session;
    },
  },
});

export const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
export const devLoginEnabled = devLogin;
