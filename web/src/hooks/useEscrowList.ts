"use client";

import { useReadContract } from "wagmi";
import { getEscrowContract } from "@/lib/contracts/config";
import type { EscrowTransaction } from "@/types/escrow";

export function useEscrowById(escrowId: bigint, chainId: number) {
  const contract = getEscrowContract(chainId);

  const { data, ...query } = useReadContract({
    ...contract,
    functionName: "getEscrow",
    args: [escrowId],
    query: { enabled: !!contract.address && escrowId >= 0n },
  });

  return {
    escrow: data as unknown as EscrowTransaction | undefined,
    ...query,
  };
}

export function useEscrowCount(chainId: number) {
  const contract = getEscrowContract(chainId);

  const { data, ...query } = useReadContract({
    ...contract,
    functionName: "getEscrowCount",
    query: { enabled: !!contract.address },
  });

  return {
    count: data ? Number(data) : 0,
    ...query,
  };
}
