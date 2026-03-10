"use client";

import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount } from "wagmi";
import { getEscrowContract } from "@/lib/contracts/config";
import { useChainId } from "wagmi";

export type KYCStatus = "verified" | "pending" | "not_verified";

// ToS message that users sign for self-attestation
export const TOS_MESSAGE = "I agree to the Credence Protocol Terms of Service and certify that I am not a citizen or resident of restricted jurisdictions.";

export function useKYC() {
  const chainId = useChainId();
  const contract = getEscrowContract(chainId);
  const { address: userAddress } = useAccount();
  
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Read KYC status for current user or any address
  const { data: kycApproved, refetch: refetchApproved } = useReadContract({
    address: contract?.address,
    abi: contract?.abi,
    functionName: "kycApproved",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!contract?.address && !!userAddress },
  });

  const { data: kycRequested, refetch: refetchRequested } = useReadContract({
    address: contract?.address,
    abi: contract?.abi,
    functionName: "kycRequested",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!contract?.address && !!userAddress },
  });

  // Read ToS accepted status (for self-attestation)
  const { data: tosAccepted, refetch: refetchTosAccepted } = useReadContract({
    address: contract?.address,
    abi: contract?.abi,
    functionName: "tosAccepted",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!contract?.address && !!userAddress },
  });

  // Determine status - prioritize verified, then pending, then ToS accepted, then not verified
  const status: KYCStatus = kycApproved === true 
    ? "verified" 
    : kycRequested === true 
      ? "pending" 
      : tosAccepted === true
        ? "verified" // ToS accepted means KYC is auto-approved
        : "not_verified";

  // Request KYC approval (legacy/manual flow - kept for backward compatibility)
  function requestKYC() {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "requestKYC",
      args: [],
    });
  }

  // Self-attest via ToS signature - automatically approves KYC
  // This is the new primary flow - no manual approval needed
  function attestKYC(signature: `0x${string}`) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "attestKYC",
      args: [signature],
    });
  }

  // Get all KYC approved addresses (for admin)
  const { data: approvedAddresses, refetch: refetchApprovedList } = useReadContract({
    address: contract?.address,
    abi: contract?.abi,
    functionName: "getKYCApprovedAddresses",
    query: { enabled: !!contract?.address },
  });

  // Get pending KYC requests (for admin)
  const { data: pendingRequests, refetch: refetchPendingList } = useReadContract({
    address: contract?.address,
    abi: contract?.abi,
    functionName: "getPendingKYCRequests",
    query: { enabled: !!contract?.address },
  });

  // Get counts
  const { data: approvedCount } = useReadContract({
    address: contract?.address,
    abi: contract?.abi,
    functionName: "getKYCApprovedCount",
    query: { enabled: !!contract?.address },
  });

  const { data: pendingCount } = useReadContract({
    address: contract?.address,
    abi: contract?.abi,
    functionName: "getPendingKYCRequestCount",
    query: { enabled: !!contract?.address },
  });

  return {
    // User functions
    status,
    requestKYC,
    attestKYC,
    tosAccepted: tosAccepted === true,
    
    // Admin functions
    approvedAddresses: (approvedAddresses as `0x${string}`[]) || [],
    pendingRequests: (pendingRequests as `0x${string}`[]) || [],
    approvedCount: (approvedCount as number) || 0,
    pendingCount: (pendingCount as number) || 0,
    
    // Transaction state
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    
    // Refetch functions
    refetch: {
      approved: refetchApproved,
      requested: refetchRequested,
      tosAccepted: refetchTosAccepted,
      approvedList: refetchApprovedList,
      pendingList: refetchPendingList,
    },
  };
}
