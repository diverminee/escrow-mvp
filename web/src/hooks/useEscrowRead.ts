"use client";

import { useReadContract } from "wagmi";
import { getEscrowContract } from "@/lib/contracts/config";
import type { EscrowTransaction, DocumentSet } from "@/types/escrow";

export function useEscrowRead(escrowId: bigint, chainId: number) {
  const contract = getEscrowContract(chainId);

  const { data: escrowRaw, ...escrowQuery } = useReadContract({
    ...contract,
    functionName: "getEscrow",
    args: [escrowId],
    query: { enabled: !!contract.address },
  });

  const { data: docsRaw, ...docsQuery } = useReadContract({
    ...contract,
    functionName: "escrowDocuments",
    args: [escrowId],
    query: { enabled: !!contract.address },
  });

  const escrow = escrowRaw as unknown as EscrowTransaction | undefined;
  const documents = docsRaw as unknown as DocumentSet | undefined;

  return {
    escrow,
    documents,
    isLoading: escrowQuery.isLoading || docsQuery.isLoading,
    isError: escrowQuery.isError || docsQuery.isError,
    refetch: () => {
      escrowQuery.refetch();
      docsQuery.refetch();
    },
  };
}

export function useEscrowCount(chainId: number) {
  const contract = getEscrowContract(chainId);

  const result = useReadContract({
    ...contract,
    functionName: "getEscrowCount",
    query: { enabled: !!contract.address },
  });

  return {
    ...result,
    data: result.data as bigint | undefined,
  };
}
