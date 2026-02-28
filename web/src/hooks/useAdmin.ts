"use client";

import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount } from "wagmi";
import { getEscrowContract } from "@/lib/contracts/config";
import { useChainId } from "wagmi";

export function useAdmin() {
  const chainId = useChainId();
  const contract = getEscrowContract(chainId);
  
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // KYC Functions
  function setKYCStatus(user: `0x${string}`, approved: boolean) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "setKYCStatus",
      args: [user, approved],
    });
  }

  function batchSetKYCStatus(users: `0x${string}`[], approved: boolean) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "batchSetKYCStatus",
      args: [users, approved],
    });
  }

  // Token Functions
  function addApprovedToken(token: `0x${string}`) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "addApprovedToken",
      args: [token],
    });
  }

  function removeApprovedToken(token: `0x${string}`) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "removeApprovedToken",
      args: [token],
    });
  }

  // Tier Functions
  function upgradeTier(tier: number) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "upgradeTier",
      args: [tier],
    });
  }

  function setMaxEscrowAmount(amount: bigint) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "setMaxEscrowAmount",
      args: [amount],
    });
  }

  function setMinEscrowAmount(amount: bigint) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "setMinEscrowAmount",
      args: [amount],
    });
  }

  // Protocol Settings
  function setFeeRecipient(recipient: `0x${string}`) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "setFeeRecipient",
      args: [recipient],
    });
  }

  function setProtocolArbiter(arbiter: `0x${string}`) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "setProtocolArbiter",
      args: [arbiter],
    });
  }

  // Pause Functions
  function pause() {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "pause",
      args: [],
    });
  }

  function unpause() {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "unpause",
      args: [],
    });
  }

  return {
    // KYC
    setKYCStatus,
    batchSetKYCStatus,
    // Tokens
    addApprovedToken,
    removeApprovedToken,
    // Tier
    upgradeTier,
    setMaxEscrowAmount,
    setMinEscrowAmount,
    // Settings
    setFeeRecipient,
    setProtocolArbiter,
    // Pause
    pause,
    unpause,
    // State
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// Hook to check if current user is owner
export function useIsOwner() {
  const { address } = useAccount();
  const chainId = useChainId();
  const contract = getEscrowContract(chainId);

  const { data: owner } = useReadContract({
    ...contract,
    functionName: "owner",
    query: { enabled: !!contract.address },
  });

  return address && owner && address.toLowerCase() === (owner as string).toLowerCase();
}

// Hook to get contract state
export function useContractState() {
  const chainId = useChainId();
  const contract = getEscrowContract(chainId);

  const { data: paused } = useReadContract({
    ...contract,
    functionName: "paused",
    query: { enabled: !!contract.address },
  });

  const { data: owner } = useReadContract({
    ...contract,
    functionName: "owner",
    query: { enabled: !!contract.address },
  });

  const { data: tier } = useReadContract({
    ...contract,
    functionName: "deploymentTier",
    query: { enabled: !!contract.address },
  });

  return {
    isPaused: paused as boolean | undefined,
    owner: owner as `0x${string}` | undefined,
    tier: tier as number | undefined,
  };
}
