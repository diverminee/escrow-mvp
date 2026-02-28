import { STATE_LABELS, STATE_COLORS } from "@/lib/constants";

export function StateChip({ state }: { state: number }) {
  const label = STATE_LABELS[state] ?? "Unknown";
  const color = STATE_COLORS[state] ?? "#A68A7A";

  return (
    <span
      style={{
        backgroundColor: color,
        color: "#ffffff",
        display: "inline-block",
        borderRadius: "9999px",
        padding: "0.25rem 0.75rem",
        fontSize: "0.75rem",
        fontWeight: 600,
        fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </span>
  );
}
