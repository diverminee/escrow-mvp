"use client";

import { useReadContract } from "wagmi";
import { getEscrowContract } from "@/lib/contracts/config";

export function useUserStats(address: `0x${string}` | undefined, chainId: number) {
  const contract = getEscrowContract(chainId);
  const enabled = !!contract.address && !!address;

  const { data: stats, ...statsQuery } = useReadContract({
    ...contract,
    functionName: "getUserStats",
    args: address ? [address] : undefined,
    query: { enabled },
  });

  const { data: tier, ...tierQuery } = useReadContract({
    ...contract,
    functionName: "getUserTier",
    args: address ? [address] : undefined,
    query: { enabled },
  });

  const { data: feeRate, ...feeQuery } = useReadContract({
    ...contract,
    functionName: "getUserFeeRate",
    args: address ? [address] : undefined,
    query: { enabled },
  });

  const { data: canDispute, ...disputeQuery } = useReadContract({
    ...contract,
    functionName: "canRaiseDispute",
    args: address ? [address] : undefined,
    query: { enabled },
  });

  return {
    stats: stats as [bigint, bigint, bigint] | undefined,
    tier: tier as number | undefined,
    feeRate: feeRate as bigint | undefined,
    canDispute: canDispute as boolean | undefined,
    isLoading:
      statsQuery.isLoading ||
      tierQuery.isLoading ||
      feeQuery.isLoading ||
      disputeQuery.isLoading,
  };
}
