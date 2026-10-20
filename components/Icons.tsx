import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 22, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const Plane = (p: P) => <Base {...p}><path d="M2.5 13.5l19-7.5-3 4.5 2 7-6.5-4.5-4 3.5-.5-4.5z" /></Base>;
export const Check = (p: P) => <Base {...p}><path d="M5 12.5l4.5 4.5L19 7" /></Base>;
export const X = (p: P) => <Base {...p}><path d="M6 6l12 12M18 6L6 18" /></Base>;
export const Heart = (p: P) => <Base {...p}><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z" /></Base>;
export const Shuffle = (p: P) => <Base {...p}><path d="M3 7h3.5c4 0 6 10 10 10H21M3 17h3.5c1.6 0 2.8-1.6 3.8-3.6M13.7 9.6C14.7 8 15.9 7 17.5 7H21M18 4l3 3-3 3M18 14l3 3-3 3" /></Base>;
export const Book = (p: P) => <Base {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M9 16h6" /></Base>;
export const Back = (p: P) => <Base {...p}><path d="M15 5l-7 7 7 7" /></Base>;
export const Undo = (p: P) => <Base {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></Base>;

export function Dice({ size = 34, face = 5 }: { size?: number; face?: number }) {
  const pips: Record<number, [number, number][]> = {
    1: [[12, 12]],
    2: [[8, 8], [16, 16]],
    3: [[7, 7], [12, 12], [17, 17]],
    4: [[8, 8], [16, 8], [8, 16], [16, 16]],
    5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
    6: [[8, 7], [16, 7], [8, 12], [16, 12], [8, 17], [16, 17]],
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#fff" stroke="#1b1f5e" strokeWidth="2" />
      {pips[face].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.8" fill="#1b1f5e" />)}
    </svg>
  );
}

const VIBE_PATHS: Record<string, React.ReactNode> = {
  food: <><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10" /><path d="M16 3c-1.7 1.5-2.5 3.5-2.5 6.5h2.5V21" /></>,
  culture: <><path d="M3 9l9-5 9 5" /><path d="M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18" /></>,
  beach: <><path d="M12 12L4 20" /><path d="M3 9a9 9 0 0 1 15 0 5 5 0 0 0-7.5 0A5 5 0 0 0 3 9z" /><path d="M14 20h7" /></>,
  nightlife: <><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></>,
  outdoors: <><path d="M3 20l6-11 4 7 2.5-4L21 20z" /><circle cx="17" cy="6" r="2" /></>,
  chill: <><path d="M4 11h14v2a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6z" /><path d="M18 12h1.5a2 2 0 0 1 0 4H17M8 4c0 2 2 2 2 4M12 4c0 2 2 2 2 4" /></>,
};

export const VibeIcon = ({ vibe, ...p }: P & { vibe: string }) => <Base {...p}>{VIBE_PATHS[vibe]}</Base>;
export const External = (p: P) => <Base {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Base>;
export const Pin = (p: P) => <Base {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></Base>;
