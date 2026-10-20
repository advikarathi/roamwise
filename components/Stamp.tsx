/** Round passport stamp with the city name curving around the top. */
export function Stamp({ city, code, date, color, size = 132, tilt = -8 }: {
  city: string; code: string; date: string; color: string; size?: number; tilt?: number;
}) {
  const id = `arc-${code}-${date.replace(/\W/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label={`${city} stamp, ${date}`} style={{ transform: `rotate(${tilt}deg)` }}>
      <defs>
        <path id={id} d="M24 70 A46 46 0 0 1 116 70" />
      </defs>
      <circle cx="70" cy="70" r="64" fill="none" stroke={color} strokeWidth="5" />
      <circle cx="70" cy="70" r="55" fill="none" stroke={color} strokeWidth="2" strokeDasharray="3 4" />
      <text fontFamily="'Bricolage Grotesque Variable', system-ui" fontWeight="800" fontSize="16" fill={color} letterSpacing="1.5">
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{city.toUpperCase()}</textPath>
      </text>
      <text x="70" y="86" textAnchor="middle" fontFamily="'Space Mono', monospace" fontWeight="700" fontSize="30" fill={color}>{code}</text>
      <text x="70" y="106" textAnchor="middle" fontFamily="'Space Mono', monospace" fontSize="11" fill={color}>{date}</text>
    </svg>
  );
}
