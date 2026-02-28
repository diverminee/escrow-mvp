import { TIER_LABELS, TIER_COLORS } from "@/lib/constants";

export function TierBadge({ tier }: { tier: number }) {
  const label = TIER_LABELS[tier] ?? "Unknown";
  const color = TIER_COLORS[tier] ?? "#A65E46";

  return (
    <span
      style={{
        color: color,
        fontSize: "1.25rem",
        fontWeight: 700,
        fontFamily: "'Playfair Display', serif",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </span>
  );
}
