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
      className="inline-flex items-center gap-1 rounded bg-gray-800 px-2 py-1 font-mono text-sm text-gray-300 transition hover:bg-gray-700"
      title={address}
    >
      {truncateAddress(address)}
      <span className="text-xs">{copied ? "copied" : "copy"}</span>
    </button>
  );
}
