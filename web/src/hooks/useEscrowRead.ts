"use client";

import { useReadContract } from "wagmi";
import { getEscrowContract } from "@/lib/contracts/config";
import type { EscrowTransaction, DocumentSet } from "@/types/escrow";

export function useEscrowRead(escrowId: bigint, chainId: number) {
  const contract = getEscrowContract(chainId);

  // Validate contract address before proceeding
  const hasValidContract = !!contract.address && contract.address !== "0x";

  const { data: escrowRaw, error: escrowError, ...escrowQuery } = useReadContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "getEscrow",
    args: [escrowId],
    query: { 
      enabled: hasValidContract,
      staleTime: 5000, // Cache for 5 seconds
      gcTime: 10000,   // Garbage collect after 10 seconds
    },
  });

  const { data: docsRaw, error: docsError, ...docsQuery } = useReadContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "escrowDocuments",
    args: [escrowId],
    query: { 
      enabled: hasValidContract,
      staleTime: 5000, // Cache for 5 seconds
      gcTime: 10000,   // Garbage collect after 10 seconds
    },
  });

  const escrow = escrowRaw as unknown as EscrowTransaction | undefined;
  const documents = docsRaw as unknown as DocumentSet | undefined;

  // Determine if we have a configuration error (contract not configured for this chain)
  const isConfigurationError = !hasValidContract && escrowId > 0n;
  
  // Determine if we have a contract error (contract exists but call failed)
  const isContractError = hasValidContract && (escrowQuery.isError || docsQuery.isError);

  // Provide more detailed error information
  const error = escrowError || docsError;

  return {
    escrow,
    documents,
    isLoading: escrowQuery.isLoading || docsQuery.isLoading,
    isError: isConfigurationError || isContractError,
    isConfigurationError,
    isContractError,
    error,
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
