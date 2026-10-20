"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { localAnswer } from "@/lib/chatLocal";
import { tripBrief, type TripSnapshot } from "@/lib/tripText";

interface Turn { role: "user" | "assistant"; content: string }

const SUGGESTIONS = ["What's on day 2?", "Where should we eat?", "Will it rain?", "How do we get from the airport?", "Are we over budget?"];

/** Links in answers become clickable; everything else stays plain text. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return <>{parts.map((p, i) => (/^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p.includes("google.com/maps") ? "Open in Google Maps" : "Open link"}</a>
    : <span key={i}>{p}</span>))}</>;
}

/** "Ask Roamwise": a floating trip assistant. Uses Claude via /api/chat when the server has a key,
 *  and the built-in answers otherwise (or in the static preview). */
export function ChatBot({ snapshot, serverMode }: { snapshot: TripSnapshot; serverMode: boolean }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const city = snapshot.plan.destinationName;

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [turns, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: q }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    let reply: string | undefined;
    if (serverMode) {
      try {
        const res = await fetch("/api/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next, brief: tripBrief(snapshot) }),
        });
        const data = (await res.json()) as { reply?: string; fallback?: boolean; error?: string };
        reply = data.reply ?? (data.fallback ? undefined : data.error);
      } catch { /* fall back below */ }
    }
    setTurns([...next, { role: "assistant", content: reply ?? localAnswer(q, snapshot) }]);
    setBusy(false);
  }

  return (
    <>
      <button type="button" className="chat-fab" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="chat-panel">
        {open ? "Close" : "Ask Roamwise"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div id="chat-panel" className="chat-panel" role="dialog" aria-label="Trip assistant"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.16 }}>
            <div className="chat-head">
              <b>Ask about your {city} trip</b>
              <button type="button" className="mini-btn" onClick={() => setOpen(false)} aria-label="Close assistant">✕</button>
            </div>
            <div className="chat-list" ref={listRef} aria-live="polite">
              {turns.length === 0 && (
                <div className="chat-msg bot">Hi! I know your flight, hotel, budget and every day of your plan. What would you like to know?</div>
              )}
              {turns.map((t, i) => (
                <div key={i} className={`chat-msg ${t.role === "user" ? "me" : "bot"}`}><Linkified text={t.content} /></div>
              ))}
              {busy && <div className="chat-msg bot muted">Thinking…</div>}
            </div>
            {turns.length === 0 && (
              <div className="chat-suggest">
                {SUGGESTIONS.map((s) => <button key={s} type="button" className="fare-tab" onClick={() => ask(s)}>{s}</button>)}
              </div>
            )}
            <form className="chat-form" onSubmit={(e) => { e.preventDefault(); void ask(draft); }}>
              <label htmlFor="chat-input" className="sr-only">Your question</label>
              <input id="chat-input" className="input" value={draft} onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask anything about the trip…" maxLength={500} autoComplete="off" />
              <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()}>Send</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
