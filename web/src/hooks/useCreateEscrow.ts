"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { getEscrowContract } from "@/lib/contracts/config";
import { EscrowMode } from "@/types/escrow";

interface CreateEscrowParams {
  seller: `0x${string}`;
  arbiter: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  tradeId: bigint;
  tradeDataHash: `0x${string}`;
  mode?: EscrowMode;
  maturityDays?: bigint;
  collateralBps?: bigint;
}

export function useCreateEscrow(chainId: number) {
  const contract = getEscrowContract(chainId);

  const {
    writeContract,
    data: hash,
    isPending,
    error,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  function createEscrow(params: CreateEscrowParams) {
    if (!contract.address) return;

    if (
      params.mode !== undefined &&
      params.mode === EscrowMode.PAYMENT_COMMITMENT
    ) {
      // 9-param overload for PAYMENT_COMMITMENT
      writeContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "createEscrow",
        args: [
          params.seller,
          params.arbiter,
          params.token,
          params.amount,
          params.tradeId,
          params.tradeDataHash,
          params.mode,
          params.maturityDays ?? 0n,
          params.collateralBps ?? 0n,
        ],
      });
    } else {
      // 6-param overload for CASH_LOCK
      writeContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "createEscrow",
        args: [
          params.seller,
          params.arbiter,
          params.token,
          params.amount,
          params.tradeId,
          params.tradeDataHash,
        ],
      });
    }
  }

  return { createEscrow, hash, isPending, isConfirming, isSuccess, error };
}
