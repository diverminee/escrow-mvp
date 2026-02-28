"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId } from "wagmi";
import Link from "next/link";
import { useReceivableBalanceOf, useReceivableTokenOfOwnerByIndex, useReceivableById } from "@/hooks/useReceivable";
import { TokenAmount } from "@/components/shared/TokenAmount";
import { formatTimestamp } from "@/lib/utils";
import { getEscrowContract } from "@/lib/contracts/config";

interface ReceivableListItemProps {
  tokenId: bigint;
}

function ReceivableListItem({ tokenId }: ReceivableListItemProps) {
  const [mounted, setMounted] = useState(false);
  const chainId = useChainId();
  const { receivable, isLoading, isError } = useReceivableById(tokenId, chainId);

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
        <span className="text-[#A68A7A]">Loading receivable #{tokenId.toString()}...</span>
      </div>
    );
  }

  if (isError || !receivable) {
    return (
      <div className="flex items-center justify-between border-b border-[#154A99] p-4">
        <span className="text-red-400">Failed to load receivable #{tokenId.toString()}</span>
      </div>
    );
  }

  return (
    <Link
      href={`/escrow/${receivable.escrowId}`}
      className="flex items-center justify-between border-b border-[#154A99] p-4 transition hover:bg-[#0A2A52]/50"
    >
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm text-[#D9AA90]">#{tokenId.toString()}</span>
        <span className={`text-sm ${receivable.settled ? "text-green-400" : "text-yellow-400"}`}>
          {receivable.settled ? "Settled" : "Active"}
        </span>
      </div>
      <div className="flex items-center gap-8">
        <div className="text-right">
          <TokenAmount amount={receivable.faceValue} token="0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" />
        </div>
        {receivable.maturityDate > 0n && (
          <span className="text-sm text-[#A68A7A]">
            {formatTimestamp(receivable.maturityDate)}
          </span>
        )}
      </div>
    </Link>
  );
}

export function ReceivableList() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { balance, isLoading: isBalanceLoading } = useReceivableBalanceOf(address, chainId);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="rounded-lg border border-[#154A99] p-8 text-center text-[#A68A7A]">
        Loading receivables...
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-[#154A99] p-8 text-center text-[#A68A7A]">
        Connect your wallet to view your receivables
      </div>
    );
  }

  if (isBalanceLoading) {
    return (
      <div className="rounded-lg border border-[#154A99] p-8 text-center text-[#A68A7A]">
        Loading receivables...
      </div>
    );
  }

  if (balance === 0) {
    return (
      <div className="rounded-lg border border-[#154A99] p-8 text-center text-[#A68A7A]">
        No receivables found. Payment Commitment escrows will mint ERC-721 receivables when documents are committed.
      </div>
    );
  }

  // Generate array of indices
  const indices = Array.from({ length: balance }, (_, i) => i);

  return (
    <div className="rounded-lg border border-[#154A99]">
      <div className="flex items-center justify-between border-b border-[#154A99] bg-[#07203F]/50 px-4 py-3">
        <span className="text-sm font-medium text-[#D9AA90]">Your Receivables</span>
        <span className="text-xs text-[#A68A7A]">{balance} total</span>
      </div>
      <div>
        {indices.map((i) => (
          <ReceivableTokenItem key={i} index={i} owner={address!} chainId={chainId} />
        ))}
      </div>
    </div>
  );
}

function ReceivableTokenItem({ index, owner, chainId }: { index: number; owner: `0x${string}`; chainId: number }) {
  const { tokenId, isLoading } = useReceivableTokenOfOwnerByIndex(owner, index, chainId);

  if (isLoading || !tokenId) {
    return (
      <div className="flex items-center justify-between border-b border-[#154A99] p-4">
        <span className="text-[#A68A7A]">Loading...</span>
      </div>
    );
  }

  return <ReceivableListItem tokenId={tokenId} />;
}
