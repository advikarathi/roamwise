"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { AgentId, AgentState } from "@/lib/types";
import { CREW, CrewAvatar } from "../CrewAvatar";

const IDEAS = ["Make it cheaper", "Nonstop flight", "Fancier stay", "Add a beach day", "More nightlife", "Apartment instead"];

export type ChangeStatus = Partial<Record<AgentId, { state: AgentState; message: string }>>;

/** Ask the crew for a change. Only the agents who need to work wake up. */
export function ChangeBar({ busy, status, error, onAsk }: {
  busy: boolean; status: ChangeStatus; error: string | null; onAsk: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const active = (Object.keys(status) as AgentId[]).filter((a) => status[a]);

  const submit = (t: string) => {
    if (!t.trim() || busy) return;
    onAsk(t.trim());
    setText("");
  };

  return (
    <section className="panel change-panel" aria-labelledby="change-h">
      <h2 className="h2" id="change-h">Ask the crew for a change</h2>
      <form className="change-form" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
        <label htmlFor="change-input" className="sr-only">Describe a change</label>
        <input id="change-input" className="input" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="e.g. cheaper, nonstop, add a beach day" disabled={busy} />
        <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>{busy ? "Working…" : "Ask"}</button>
      </form>
      <div className="idea-chips">
        {IDEAS.map((i) => (
          <button key={i} type="button" className="fare-tab" onClick={() => submit(i)} disabled={busy}>{i}</button>
        ))}
      </div>

      <AnimatePresence>
        {active.length > 0 && (
          <motion.div className="change-crew" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} aria-live="polite">
            {active.map((a) => (
              <div key={a} className="change-crew-row">
                <CrewAvatar agent={a} state={status[a]!.state} size={40} />
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 800 }}>{CREW[a].name}</span>{" "}
                  <span className="small">{status[a]!.message}</span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className="small" role="alert" style={{ margin: "10px 0 0", fontWeight: 600, color: "#c2321b" }}>{error}</p>}
    </section>
  );
}
