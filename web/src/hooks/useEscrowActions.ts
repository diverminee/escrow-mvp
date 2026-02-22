"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { getEscrowContract } from "@/lib/contracts/config";

export function useEscrowActions(chainId: number) {
  const contract = getEscrowContract(chainId);

  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  function confirmDelivery(escrowId: bigint) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "confirmDelivery",
      args: [escrowId],
    });
  }

  function commitDocuments(
    escrowId: bigint,
    invoiceHash: `0x${string}`,
    bolHash: `0x${string}`,
    packingHash: `0x${string}`,
    cooHash: `0x${string}`
  ) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "commitDocuments",
      args: [escrowId, invoiceHash, bolHash, packingHash, cooHash],
    });
  }

  function fulfillCommitment(
    escrowId: bigint,
    token: `0x${string}`,
    remaining: bigint
  ) {
    if (!contract.address) return;
    const isETH = token === "0x0000000000000000000000000000000000000000";
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "fulfillCommitment",
      args: [escrowId],
      value: isETH ? remaining : 0n,
    });
  }

  function raiseDispute(escrowId: bigint) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "raiseDispute",
      args: [escrowId],
    });
  }

  function resolveDispute(escrowId: bigint, ruling: 1 | 2) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "resolveDispute",
      args: [escrowId, ruling],
    });
  }

  function escalateToProtocol(escrowId: bigint) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "escalateToProtocol",
      args: [escrowId],
    });
  }

  function claimTimeout(escrowId: bigint) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "claimTimeout",
      args: [escrowId],
    });
  }

  return {
    confirmDelivery,
    commitDocuments,
    fulfillCommitment,
    raiseDispute,
    resolveDispute,
    escalateToProtocol,
    claimTimeout,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}
