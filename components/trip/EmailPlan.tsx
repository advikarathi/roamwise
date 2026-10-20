"use client";
import { useState } from "react";
import { planEmail, type TripSnapshot } from "@/lib/tripText";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; to: string } | { kind: "fallback" } | { kind: "error"; message: string };

/** "Email this plan": sends a formatted email when the server can send mail, and otherwise
 *  hands the plan to the traveler's own mail app (or as a file to keep). */
export function EmailPlan({ snapshot, serverMode }: { snapshot: TripSnapshot; serverMode: boolean }) {
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const build = () => planEmail(snapshot, typeof window === "undefined" ? "" : window.location.origin);

  function openMailApp() {
    const { subject, text } = build();
    // Mail apps cap how long a mailto link can be, so long plans get trimmed with a pointer to the file.
    const body = text.length > 1800 ? `${text.slice(0, 1700)}\n…\n(Full plan: use "Download plan" in Roamwise.)` : text;
    window.location.href = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  function download() {
    const { subject, html } = build();
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${subject.replace(/[^\w-]+/g, "-")}.html` });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!serverMode) { setStatus({ kind: "fallback" }); return; }
    setStatus({ kind: "sending" });
    try {
      const { subject, text, html } = build();
      const res = await fetch("/api/email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, text, html }),
      });
      const data = (await res.json()) as { sent?: boolean; fallback?: boolean; error?: string };
      if (data.sent) setStatus({ kind: "sent", to });
      else if (data.fallback) setStatus({ kind: "fallback" });
      else setStatus({ kind: "error", message: data.error ?? "Couldn't send it." });
    } catch {
      setStatus({ kind: "error", message: "Couldn't reach the server. Try the mail app option." });
    }
  }

  return (
    <section className="panel" aria-labelledby="email-h">
      <h2 className="h2" id="email-h">Email this plan</h2>
      <p className="small muted" style={{ marginTop: -6 }}>Flights, hotel, every day of your plan, photos and booking links, in one email.</p>
      <form className="change-form" onSubmit={send}>
        <label htmlFor="email-to" className="sr-only">Email address</label>
        <input id="email-to" className="input" type="email" required placeholder="you@example.com" value={to}
          onChange={(e) => { setTo(e.target.value); setStatus({ kind: "idle" }); }} autoComplete="email" />
        <button type="submit" className="btn btn-primary" disabled={status.kind === "sending"}>{status.kind === "sending" ? "Sending…" : "Send"}</button>
      </form>
      {status.kind === "sent" && <p className="small" style={{ fontWeight: 700 }}>Sent to {status.to}. Check your inbox (and spam folder, just in case).</p>}
      {status.kind === "error" && <p className="small" style={{ color: "#b3261e", fontWeight: 600 }}>{status.message}</p>}
      {(status.kind === "fallback" || status.kind === "error") && (
        <p className="small" style={{ marginBottom: 0 }}>
          {status.kind === "fallback" && "Email sending isn't set up yet. "}
          <button type="button" className="btn-ghost" onClick={openMailApp}>Open it in your mail app</button>
          {" or "}
          <button type="button" className="btn-ghost" onClick={download}>download the plan</button>.
        </p>
      )}
      {status.kind === "idle" && (
        <p className="small muted" style={{ marginBottom: 0 }}>
          Or <button type="button" className="btn-ghost" style={{ height: "auto", padding: 0 }} onClick={download}>download the plan</button> to keep or print.
        </p>
      )}
    </section>
  );
}
