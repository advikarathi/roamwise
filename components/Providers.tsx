"use client";
import { SessionProvider } from "next-auth/react";

/** Makes the sign-in session available to the app (useSession). */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
