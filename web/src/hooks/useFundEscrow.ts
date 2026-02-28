"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { erc20Abi } from "viem";
import { getEscrowContract } from "@/lib/contracts/config";
import { ZERO_ADDRESS } from "@/lib/constants";

export function useFundEscrow(chainId: number) {
  const contract = getEscrowContract(chainId);

  const {
    writeContract,
    data: hash,
    isPending,
    error,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  function fund(escrowId: bigint, token: `0x${string}`, amount: bigint) {
    if (!contract.address) return;

    if (token === ZERO_ADDRESS) {
      // ETH: send value directly
      writeContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "fund",
        args: [escrowId],
        value: amount,
      });
    } else {
      // ERC20: must approve first, then fund
      writeContract({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [contract.address, amount],
      });
    }
  }

  function fundAfterApproval(escrowId: bigint, token: `0x${string}`, amount: bigint) {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "fund",
      args: [escrowId],
    });
  }

  return {
    fund,
    fundAfterApproval,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
