import { STATE_LABELS, STATE_COLORS } from "@/lib/constants";

export function StateChip({ state }: { state: number }) {
  const label = STATE_LABELS[state] ?? "Unknown";
  const color = STATE_COLORS[state] ?? "bg-gray-500";

  return (
    <span
      className={`${color} inline-block rounded-full px-3 py-1 text-xs font-semibold text-white`}
    >
      {label}
    </span>
  );
}
