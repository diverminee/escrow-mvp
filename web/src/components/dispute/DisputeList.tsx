"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId } from "wagmi";
import Link from "next/link";
import { useEscrowRead, useEscrowCount } from "@/hooks/useEscrowRead";
import { EscrowState } from "@/types/escrow";
import { StateChip } from "@/components/shared/StateChip";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { TokenAmount } from "@/components/shared/TokenAmount";
import { formatTimestamp, isExpired } from "@/lib/utils";
import { DISPUTE_TIMELOCK } from "@/lib/constants";

interface DisputeListItemProps {
  escrowId: bigint;
}

function DisputeListItem({ escrowId }: DisputeListItemProps) {
  const [mounted, setMounted] = useState(false);
  const chainId = useChainId();
  const { escrow, isLoading, isError } = useEscrowRead(escrowId, chainId);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-between border-b border-[#154A99] p-4">
        <span className="text-[#A68A7A]">Loading...</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-between border-b border-[#154A99] p-4">
        <span className="text-[#A68A7A]">Loading escrow #{String(escrowId)}...</span>
      </div>
    );
  }

  if (isError || !escrow) {
    return null;
  }

  const state = Number(escrow.state);
  // Only show disputed/escalated escrows
  if (state !== EscrowState.DISPUTED && state !== EscrowState.ESCALATED) {
    return null;
  }

  const deadline = Number(escrow.disputeDeadline);
  const now = Math.floor(Date.now() / 1000);
  const timeLeft = deadline - now;
  const isOverdue = isExpired(escrow.disputeDeadline);

  return (
    <Link
      href={`/escrow/${escrowId}`}
      className="flex items-center justify-between border-b border-[#154A99] p-4 transition hover:bg-[#0A2A52]/50"
    >
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm text-[#D9AA90]">#{String(escrowId)}</span>
        <StateChip state={state} />
        <span className="text-sm text-[#A68A7A]">
          {state === EscrowState.ESCALATED ? "Escalated" : "Disputed"}
        </span>
      </div>
      <div className="flex items-center gap-8">
        <div className="text-right">
          <span className={`text-sm ${isOverdue ? "text-red-400" : "text-yellow-400"}`}>
            {isOverdue 
              ? "Overdue" 
              : timeLeft > 86400 
                ? `${Math.floor(timeLeft / 86400)}d left` 
                : `${Math.floor(timeLeft / 3600)}h left`
            }
          </span>
        </div>
        <AddressDisplay address={escrow.buyer} />
      </div>
    </Link>
  );
}

export function DisputeList() {
  const [mounted, setMounted] = useState(false);
  const chainId = useChainId();
  const { data: escrowCount, isLoading: isCountLoading } = useEscrowCount(chainId);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="rounded-lg border border-[#154A99] p-8 text-center text-[#A68A7A]">
        Loading disputes...
      </div>
    );
  }

  if (isCountLoading) {
    return (
      <div className="rounded-lg border border-[#154A99] p-8 text-center text-[#A68A7A]">
        Loading disputes...
      </div>
    );
  }

  const count = escrowCount ? Number(escrowCount) : 0;

  if (count === 0) {
    return (
      <div className="rounded-lg border border-[#154A99] p-8 text-center text-[#A68A7A]">
        No disputes found.
      </div>
    );
  }

  // Generate array of escrow IDs to check
  const escrowIds: bigint[] = [];
  for (let i = 0; i < count; i++) {
    escrowIds.push(BigInt(i));
  }

  return (
    <div className="rounded-lg border border-[#154A99]">
      <div className="flex items-center justify-between border-b border-[#154A99] bg-[#07203F]/50 px-4 py-3">
        <span className="text-sm font-medium text-[#D9AA90]">Active Disputes</span>
      </div>
      <div>
        {escrowIds.map((id) => (
          <DisputeListItem key={id.toString()} escrowId={id} />
        ))}
      </div>
    </div>
  );
}
