// Sign-in with Auth.js: GitHub and/or Google, whichever has credentials in the environment
// (AUTH_GITHUB_ID/SECRET, AUTH_GOOGLE_ID/SECRET), plus AUTH_SECRET to sign the session cookie.
// Sessions are signed JWT cookies, so there's no user table; a user's saved trips live in Redis
// under their stable id (lib/userStore.ts). Signing in is optional; the app works without it.
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

const providers = [
  ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET ? [GitHub] : []),
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google] : []),
];

export const authEnabled = providers.length > 0 && !!process.env.AUTH_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    // A stable id per account across sign-ins: "github:12345" / "google:6789".
    jwt({ token, account }) {
      if (account) token.uid = `${account.provider}:${account.providerAccountId}`;
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});

/** The signed-in user's id, or null. For API routes. */
export async function currentUserId(): Promise<string | null> {
  if (!authEnabled) return null;
  const session = await auth();
  return session?.user?.id ?? null;
}
