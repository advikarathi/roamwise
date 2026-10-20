"use client";
import confetti from "canvas-confetti";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { runPlan, type RunMode } from "@/lib/runPlan";
import type { PlanEvent, TripPlan, TripRequest } from "@/lib/types";
import { Book } from "./Icons";
import { Passport } from "./Passport";
import { ORDER, Planning, type CrewStatus } from "./Planning";
import { Setup, defaultRequest } from "./Setup";
import { Stamp } from "./Stamp";
import { Trip, type SavedTrip } from "./Trip";
import type { SharedTrip } from "@/lib/tripStore";

type Screen = "setup" | "planning" | "trip" | "passport";

const STORE_KEY = "roamwise:passport";

function loadTrips(): SavedTrip[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]") as SavedTrip[];
  } catch {
    return [];
  }
}
function storeTrips(trips: SavedTrip[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(trips));
  } catch {
    /* storage can be unavailable (private mode); stamps still show this session */
  }
}

const freshCrew = (): CrewStatus => ({
  budget: { state: "waiting", message: "Ready when you are" },
  flights: { state: "waiting", message: "Ready when you are" },
  stays: { state: "waiting", message: "Ready when you are" },
  activities: { state: "waiting", message: "Ready when you are" },
});

const COLORS = ["#3d7bff", "#ffc93c", "#2ec4a0", "#ff7fbf", "#ff5a3c"];

export function App({ mode = "server", sharedId }: { mode?: RunMode; sharedId?: string }) {
  const reduce = useReducedMotion();
  const [screen, setScreen] = useState<Screen>("setup");
  const [request, setRequest] = useState<TripRequest>(defaultRequest);
  const [crew, setCrew] = useState<CrewStatus>(freshCrew);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [slam, setSlam] = useState<SavedTrip | null>(null);
  const [shared, setShared] = useState<SharedTrip | undefined>(undefined);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const runId = useRef(0);
  const [demoKeeps, setDemoKeeps] = useState<string[] | undefined>(undefined);
  const [demoError, setDemoError] = useState<string | null>(null);

  /** Opens a ready-made trip, moved to start a few weeks from today so the dates never look stale. */
  async function openDemo(code: string) {
    setDemoError(null);
    try {
      const res = await fetch(`/demos/${code}.json`);
      if (!res.ok) throw new Error();
      const demo = (await res.json()) as { plan: TripPlan; keeps: string[] };
      const nights = demo.plan.nights;
      const start = new Date();
      start.setUTCDate(start.getUTCDate() + 42);
      const end = new Date(start.getTime() + nights * 86_400_000);
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const moved: TripPlan = { ...demo.plan, request: { ...demo.plan.request, startDate: iso(start), endDate: iso(end) } };
      runId.current++;
      setShared(undefined);
      setDemoKeeps(demo.keeps);
      setPlan(moved);
      setRequest(moved.request);
      setScreen("trip");
    } catch {
      setDemoError("Couldn't open the demo trip. Try planning one instead.");
    }
  }

  useEffect(() => setTrips(loadTrips()), []);

  // Opening a friend's share link loads their trip straight onto the board.
  useEffect(() => {
    if (!sharedId) return;
    fetch(`/api/trips/${sharedId}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "This trip link has expired or doesn't exist. Ask your friend for a new one." : "Couldn't load this trip.");
        const t = (await r.json()) as SharedTrip;
        setShared(t);
        setPlan(t.plan);
        setRequest(t.plan.request);
        setScreen("trip");
      })
      .catch((e: Error) => setSharedError(e.message));
  }, [sharedId]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [screen]);

  const burst = () => {
    if (reduce) return;
    confetti({ particleCount: 110, spread: 75, origin: { y: 0.65 }, colors: COLORS, disableForReducedMotion: true });
  };

  async function start(req: TripRequest) {
    const id = ++runId.current;
    setRequest(req);
    setCrew(freshCrew());
    setPlan(null);
    setError(null);
    setScreen("planning");

    const onEvent = (e: PlanEvent) => {
      if (id !== runId.current) return; // a newer plan started
      if (e.type === "status") setCrew((c) => ({ ...c, [e.agent]: { state: e.state, message: e.message } }));
      if (e.type === "error") setError(e.message);
      if (e.type === "plan") {
        setPlan(e.plan);
        setCrew((c) => {
          const n = { ...c };
          for (const a of ORDER) if (n[a].state !== "done") n[a] = { ...n[a], state: "done" };
          return n;
        });
        burst();
        setTimeout(() => { if (id === runId.current) setScreen("trip"); }, 1300);
      }
    };

    try {
      await runPlan(req, mode, onEvent);
    } catch (err) {
      if (id === runId.current) setError(err instanceof Error ? err.message : "Couldn't reach the crew. Check your connection and try again.");
    }
  }

  function save(t: SavedTrip) {
    const next = [t, ...trips.filter((x) => !(x.code === t.code && x.startDate === t.startDate))];
    setTrips(next);
    storeTrips(next);
    setSlam(t);
    setTimeout(burst, 350);
    setTimeout(() => { setSlam(null); setScreen("passport"); }, 1700);
  }

  return (
    <div className="shell">
      <nav className="topbar" aria-label="Main">
        <button type="button" className="logo" onClick={() => setScreen(plan ? "trip" : "setup")} aria-label="Roamwise home">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="13" fill="#ffc93c" stroke="#1b1f5e" strokeWidth="2.5" />
            <path d="M6 19q10-10 20-6" fill="none" stroke="#1b1f5e" strokeWidth="2.5" strokeDasharray="1 4" strokeLinecap="round" />
            <path d="M21 9l6 3-6 2z" fill="#fff" stroke="#1b1f5e" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          Roamwise
        </button>
        <button type="button" className="passport-btn" onClick={() => setScreen("passport")}>
          <Book size={20} /> Passport <span className="count">{trips.length}</span>
        </button>
      </nav>

      <AnimatePresence mode="wait">
        <motion.main
          key={screen}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          {screen === "setup" && sharedError && <div className="error-box narrow" role="alert" style={{ marginBottom: 20 }}>{sharedError}</div>}
          {screen === "setup" && demoError && <div className="error-box narrow" role="alert" style={{ marginBottom: 20 }}>{demoError}</div>}
          {screen === "setup" && <Setup initial={request} onSubmit={(r) => { setShared(undefined); setDemoKeeps(undefined); start(r); }} onDemo={openDemo} />}
          {screen === "planning" && <Planning request={request} crew={crew} error={error} onBack={() => setScreen("setup")} />}
          {screen === "trip" && plan && <Trip key={shared?.id ?? plan.request.destination + plan.request.startDate + runId.current} plan={plan} mode={mode} shared={shared} initialKeeps={demoKeeps} onSave={save} onNew={() => setScreen("setup")} />}
          {screen === "passport" && <Passport trips={trips} onPlan={() => setScreen("setup")} />}
        </motion.main>
      </AnimatePresence>

      <AnimatePresence>
        {slam && (
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status" aria-label={`${slam.city} added to your passport`}>
            <motion.div
              initial={reduce ? false : { scale: 3, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: -8, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 14 }}
              style={{ background: "#fff", borderRadius: "50%", padding: 12, border: "2px solid #1b1f5e", boxShadow: "6px 6px 0 #1b1f5e" }}
            >
              <Stamp city={slam.city} code={slam.code} color={slam.color} size={220} tilt={0}
                date={new Date(`${slam.startDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "2-digit" }).toUpperCase()} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
