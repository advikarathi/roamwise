"use client";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type Provider = { id: string; name: string };

/** Top-bar account button. Hidden entirely when no sign-in provider is configured. */
export function AuthButton({ onMyTrips }: { onMyTrips: () => void }) {
  const { data: session, status } = useSession();
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/me/trips")
      .then((r) => r.json() as Promise<{ enabled?: boolean }>)
      .then((j) => (j.enabled === false ? [] : fetch("/api/auth/providers").then((r) => r.json() as Promise<Record<string, Provider>>).then((p) => Object.values(p ?? {}))))
      .then(setProviders)
      .catch(() => setProviders([]));
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!providers?.length || status === "loading") return null;

  const user = session?.user;
  return (
    <div className="auth" ref={ref}>
      <button type="button" className="passport-btn" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        {user?.image ? <img src={user.image} alt="" className="auth-avatar" /> : <span className="auth-avatar auth-initial">{(user?.name ?? "?")[0]}</span>}
        <span className="auth-label">{user ? (user.name?.split(" ")[0] ?? "Account") : "Sign in"}</span>
      </button>
      {open && (
        <div className="auth-menu" role="menu">
          {user ? (
            <>
              <div className="small muted" style={{ padding: "4px 10px 8px" }}>Signed in as {user.email ?? user.name}</div>
              <button type="button" role="menuitem" onClick={() => { setOpen(false); onMyTrips(); }}>My trips</button>
              <button type="button" role="menuitem" onClick={() => signOut({ redirect: false })}>Sign out</button>
            </>
          ) : (
            <>
              <div className="small muted" style={{ padding: "4px 10px 8px" }}>Save trips to your account and open them on any device.</div>
              {providers.map((p) => (
                <button key={p.id} type="button" role="menuitem" onClick={() => signIn(p.id)}>Continue with {p.name}</button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
