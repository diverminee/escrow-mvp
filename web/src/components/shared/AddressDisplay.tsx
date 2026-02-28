"use client";

import { truncateAddress } from "@/lib/utils";
import { useState } from "react";

export function AddressDisplay({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded bg-[#07203F] px-2 py-1 font-mono text-sm text-[#D9AA90] transition hover:bg-[#0A2A52]"
      title={address}
    >
      {truncateAddress(address)}
      <span className="text-xs">{copied ? "copied" : "copy"}</span>
    </button>
  );
}
