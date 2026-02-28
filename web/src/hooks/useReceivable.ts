"use client";

import { useReadContract } from "wagmi";
import { getReceivableContract, getEscrowContract } from "@/lib/contracts/config";

export interface ReceivableInfo {
  escrowId: bigint;
  faceValue: bigint;
  collateralAmount: bigint;
  maturityDate: bigint;
  settled: boolean;
}

export function useReceivableById(tokenId: bigint, chainId: number) {
  const contract = getReceivableContract(chainId);

  const { data, ...query } = useReadContract({
    ...contract,
    functionName: "getReceivable",
    args: [tokenId],
    query: { enabled: !!contract.address && tokenId >= 0n },
  });

  return {
    receivable: data as unknown as ReceivableInfo | undefined,
    ...query,
  };
}

export function useReceivableByEscrow(escrowId: bigint, chainId: number) {
  const contract = getEscrowContract(chainId);

  const { data: tokenId, ...tokenQuery } = useReadContract({
    ...contract,
    functionName: "getReceivableTokenId",
    args: [escrowId],
    query: { enabled: !!contract.address },
  });

  if (!tokenId || tokenId === 0n) {
    return { receivable: undefined, tokenId: undefined, isLoading: false, isError: false };
  }

  const receivableContract = getReceivableContract(chainId);
  const { data, ...receivableQuery } = useReadContract({
    ...receivableContract,
    functionName: "getReceivable",
    args: [tokenId],
    query: { enabled: !!receivableContract.address },
  });

  return {
    receivable: data as unknown as ReceivableInfo | undefined,
    tokenId,
    isLoading: tokenQuery.isLoading || receivableQuery.isLoading,
    isError: tokenQuery.isError || receivableQuery.isError,
  };
}

export function useReceivableBalanceOf(owner: `0x${string}` | undefined, chainId: number) {
  const contract = getReceivableContract(chainId);

  const { data, ...query } = useReadContract({
    ...contract,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: { enabled: !!contract.address && !!owner },
  });

  return {
    balance: data ? Number(data) : 0,
    ...query,
  };
}

export function useReceivableTokenOfOwnerByIndex(owner: `0x${string}` | undefined, index: number, chainId: number) {
  const contract = getReceivableContract(chainId);

  const { data, ...query } = useReadContract({
    ...contract,
    functionName: "tokenOfOwnerByIndex",
    args: owner ? [owner, BigInt(index)] : undefined,
    query: { enabled: !!contract.address && !!owner && index >= 0 },
  });

  return {
    tokenId: data as bigint | undefined,
    ...query,
  };
}
