import { TIER_LABELS, TIER_COLORS } from "@/lib/constants";

export function TierBadge({ tier }: { tier: number }) {
  const label = TIER_LABELS[tier] ?? "Unknown";
  const color = TIER_COLORS[tier] ?? "text-gray-400";

  return (
    <span className={`${color} text-sm font-bold uppercase tracking-wide`}>
      {label}
    </span>
  );
}
