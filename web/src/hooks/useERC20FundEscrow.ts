"use client";

import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { erc20Abi } from "viem";
import { getEscrowContract } from "@/lib/contracts/config";

interface ERC20FundEscrowResult {
  approve: (token: `0x${string}`, spender: `0x${string}`, amount: bigint) => void;
  fund: (escrowId: bigint) => void;
  isApproving: boolean;
  isFunding: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  error: Error | null;
  reset: () => void;
}

export function useERC20FundEscrow(chainId: number): ERC20FundEscrowResult {
  const contract = getEscrowContract(chainId);
  
  const [tokenAddress, setTokenAddress] = useState<`0x${string}` | null>(null);
  const [spenderAddress, setSpenderAddress] = useState<`0x${string}` | null>(null);
  const [amount, setAmount] = useState<bigint | null>(null);
  const [escrowId, setEscrowId] = useState<bigint | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isFunding, setIsFunding] = useState(false);

  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
  } = useWriteContract();

  const {
    writeContract: writeFund,
    data: fundHash,
    isPending: isFundPending,
    error: fundError,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ 
    hash: approveHash 
  });

  const { isLoading: isFundConfirming, isSuccess: fundSuccess } = useWaitForTransactionReceipt({ 
    hash: fundHash 
  });

  const approve = (token: `0x${string}`, spender: `0x${string}`, amount: bigint) => {
    if (!contract.address) return;
    
    setTokenAddress(token);
    setSpenderAddress(spender);
    setAmount(amount);
    setIsApproving(true);
    
    writeApprove({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, amount],
    });
  };

  const fund = (escrowId: bigint) => {
    if (!contract.address || !tokenAddress || !spenderAddress || !amount) return;
    
    setEscrowId(escrowId);
    setIsFunding(true);
    
    writeFund({
      address: contract.address,
      abi: contract.abi,
      functionName: "fund",
      args: [escrowId],
    });
  };

  const reset = () => {
    setTokenAddress(null);
    setSpenderAddress(null);
    setAmount(null);
    setEscrowId(null);
    setIsApproving(false);
    setIsFunding(false);
  };

  // Auto-proceed to funding after approval is confirmed
  useEffect(() => {
    if (approveSuccess && isApproving && tokenAddress && spenderAddress && amount && escrowId) {
      setIsApproving(false);
      fund(escrowId);
    }
  }, [approveSuccess, isApproving, tokenAddress, spenderAddress, amount, escrowId]);

  const isConfirming = isApproveConfirming || isFundConfirming;
  const isSuccess = fundSuccess;
  const error = approveError || fundError;

  return {
    approve,
    fund,
    isApproving,
    isFunding,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}