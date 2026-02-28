"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { EscrowState, EscrowMode } from "@/types/escrow";
import { useFundEscrow } from "@/hooks/useFundEscrow";
import { useERC20FundEscrow } from "@/hooks/useERC20FundEscrow";
import { useEscrowRead } from "@/hooks/useEscrowRead";
import { EscrowTransaction } from "@/types/escrow";
import { getEscrowContract } from "@/lib/contracts/config";
import { isExpired } from "@/lib/utils";

interface EscrowActionsProps {
  escrowId: bigint;
  escrow: EscrowTransaction;
}

export function EscrowActions({ escrowId, escrow }: EscrowActionsProps) {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }
  const { refetch } = useEscrowRead(escrowId, chainId);
  const fundEscrow = useFundEscrow(chainId);

  const { writeContract, isPending: isWritePending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: fundEscrow.hash
  });

  const contract = getEscrowContract(chainId);

  const [fundAmount, setFundAmount] = useState("");
  const [invoiceHash, setInvoiceHash] = useState("");
  const [bolHash, setBolHash] = useState("");
  const [packingHash, setPackingHash] = useState("");
  const [cooHash, setCooHash] = useState("0x0000000000000000000000000000000000000000000000000000000000000000");
  const [showFundModal, setShowFundModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const isBuyer = address && address.toLowerCase() === escrow.buyer.toLowerCase();
  const isSeller = address && address.toLowerCase() === escrow.seller.toLowerCase();
  const isArbiter = address && address.toLowerCase() === escrow.arbiter.toLowerCase();
  const isParty = isBuyer || isSeller || isArbiter;

  const state = Number(escrow.state);
  const mode = Number(escrow.mode);
  const isCashLock = mode === EscrowMode.CASH_LOCK;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const isMatured = escrow.maturityDate > 0 && now > escrow.maturityDate;
  const hasDocuments = escrow.tradeDataHash !== "0x0000000000000000000000000000000000000000000000000000000000000000";

  // Determine which actions to show based on state and role
  const showFund = isBuyer && state === EscrowState.DRAFT;
  const showCommitDocs = isSeller && state === EscrowState.FUNDED;
  const showConfirm = isBuyer && state === EscrowState.FUNDED && hasDocuments;
  const showFulfill = isBuyer && state === EscrowState.FUNDED && mode === EscrowMode.PAYMENT_COMMITMENT && !escrow.commitmentFulfilled;
  const showClaimDefault = isSeller && mode === EscrowMode.PAYMENT_COMMITMENT && isMatured && !escrow.commitmentFulfilled;
  const showRaiseDispute = isParty && (state === EscrowState.FUNDED || state === EscrowState.DISPUTED);
  const showResolveDispute = isArbiter && state === EscrowState.DISPUTED;
  const showEscalate = isParty && state === EscrowState.DISPUTED && isExpired(escrow.disputeDeadline);
  const showTimeout = isParty && state === EscrowState.ESCALATED && isExpired(escrow.disputeDeadline);

  const handleFund = () => {
    if (!fundAmount || !contract.address) return;
    const decimals = escrow.token === "0x0000000000000000000000000000000000000000" ? 18n : 6n;
    const amount = decimals === 18n
      ? parseEther(fundAmount)
      : BigInt(Math.floor(parseFloat(fundAmount) * 10 ** 6));

    if (escrow.token !== "0x0000000000000000000000000000000000000000") {
      // For ERC20, first approve
      fundEscrow.fund(escrowId, escrow.token, amount);
    } else {
      // For ETH, send value directly
      writeContract({
        address: contract.address,
        abi: contract.abi,
        functionName: "fund",
        args: [escrowId],
        value: amount,
      });
    }
  };

  const handleCommitDocuments = () => {
    if (!invoiceHash || !contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "commitDocuments",
      args: [escrowId, invoiceHash as `0x${string}`, bolHash as `0x${string}`, packingHash as `0x${string}`, cooHash as `0x${string}`],
    });
  };

  const handleConfirmDelivery = () => {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "confirmDelivery",
      args: [escrowId],
    });
  };

  const handleFulfillCommitment = () => {
    if (!contract.address) return;
    const remaining = escrow.amount - escrow.collateralAmount;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "fulfillCommitment",
      args: [escrowId],
    });
  };

  const handleClaimDefault = () => {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "claimDefaultedCommitment",
      args: [escrowId],
    });
  };

  const handleRaiseDispute = () => {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "raiseDispute",
      args: [escrowId],
    });
  };

  const handleResolveDispute = (ruling: 1 | 2) => {
    if (!contract.address) return;
    // 1 = Release to buyer, 2 = Refund to seller (opposite of what was implemented)
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "resolveDispute",
      args: [escrowId, ruling],
    });
  };

  const handleEscalate = () => {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "escalateToProtocol",
      args: [escrowId],
    });
  };

  const handleClaimTimeout = () => {
    if (!contract.address) return;
    writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName: "claimTimeout",
      args: [escrowId],
    });
  };

  const isPending = isWritePending || fundEscrow.isPending;
  const isAllConfirming = isConfirming || fundEscrow.isConfirming;
  const error = writeError || fundEscrow.error;

  if (!isConnected || !isParty) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Actions</h3>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
          Error: {error.message}
        </div>
      )}

      {/* Fund Escrow */}
      {showFund && (
        <button
          onClick={() => setShowFundModal(true)}
          className="w-full rounded-lg bg-[#A65E46] px-4 py-2 text-white transition hover:bg-[#C47154]"
        >
          Fund Escrow
        </button>
      )}

      {/* Commit Documents */}
      {showCommitDocs && (
        <button
          onClick={() => setShowDocumentModal(true)}
          className="w-full rounded-lg bg-[#1A5AB8] px-4 py-2 text-white transition hover:bg-[#2470D0]"
        >
          Commit Documents
        </button>
      )}

      {/* Confirm Delivery */}
      {showConfirm && (
        <button
          onClick={handleConfirmDelivery}
          disabled={isPending || isAllConfirming}
          className="w-full rounded-lg bg-[#22C55E] px-4 py-2 text-white transition hover:bg-[#16a34a] disabled:opacity-50"
        >
          {isPending ? "Signing..." : isAllConfirming ? "Confirming..." : "Confirm Delivery"}
        </button>
      )}

      {/* Fulfill Commitment */}
      {showFulfill && (
        <button
          onClick={handleFulfillCommitment}
          disabled={isPending || isAllConfirming}
          className="w-full rounded-lg bg-[#22C55E] px-4 py-2 text-white transition hover:bg-[#16a34a] disabled:opacity-50"
        >
          {isPending ? "Signing..." : isAllConfirming ? "Confirming..." : "Fulfill Commitment"}
        </button>
      )}

      {/* Claim Defaulted */}
      {showClaimDefault && (
        <button
          onClick={handleClaimDefault}
          disabled={isPending || isAllConfirming}
          className="w-full rounded-lg bg-[#EF4444] px-4 py-2 text-white transition hover:bg-[#dc2626] disabled:opacity-50"
        >
          {isPending ? "Signing..." : isAllConfirming ? "Confirming..." : "Claim Defaulted Commitment"}
        </button>
      )}

      {/* Raise Dispute */}
      {showRaiseDispute && (
        <button
          onClick={() => setShowDisputeModal(true)}
          className="w-full rounded-lg border border-[#EF4444] px-4 py-2 text-[#EF4444] transition hover:bg-[#EF4444]/10"
        >
          Raise Dispute
        </button>
      )}

      {/* Resolve Dispute */}
      {showResolveDispute && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleResolveDispute(1)}
            disabled={isPending || isAllConfirming}
            className="rounded-lg bg-[#22C55E] px-4 py-2 text-white transition hover:bg-[#16a34a] disabled:opacity-50"
          >
            Release to Seller
          </button>
          <button
            onClick={() => handleResolveDispute(2)}
            disabled={isPending || isAllConfirming}
            className="rounded-lg bg-[#EF4444] px-4 py-2 text-white transition hover:bg-[#dc2626] disabled:opacity-50"
          >
            Refund Buyer
          </button>
        </div>
      )}

      {/* Escalate */}
      {showEscalate && (
        <button
          onClick={handleEscalate}
          disabled={isPending || isAllConfirming}
          className="w-full rounded-lg border border-[#D9AA90] px-4 py-2 text-[#D9AA90] transition hover:bg-[#D9AA90]/10 disabled:opacity-50"
        >
          {isPending ? "Signing..." : "Escalate to Protocol Arbiter"}
        </button>
      )}

      {/* Claim Timeout */}
      {showTimeout && (
        <button
          onClick={handleClaimTimeout}
          disabled={isPending || isAllConfirming}
          className="w-full rounded-lg border border-[#A68A7A] px-4 py-2 text-[#A68A7A] transition hover:bg-[#A68A7A]/10 disabled:opacity-50"
        >
          {isPending ? "Signing..." : "Claim Timeout"}
        </button>
      )}

      {/* Fund Modal */}
      {showFundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[#154A99] bg-[#07203F] p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Fund Escrow</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-[#D9AA90]">Amount to fund</label>
                <input
                  type="number"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[#154A99] bg-[#0A2A52] px-3 py-2 text-white"
                />
                <p className="mt-1 text-sm text-[#A68A7A]">
                  {isCashLock
                    ? `Full amount: ${Number(escrow.amount) / (escrow.token === "0x0000000000000000000000000000000000000000" ? 1e18 : 1e6)} ${escrow.token === "0x0000000000000000000000000000000000000000" ? "ETH" : "USDC/USDT"}`
                    : `Collateral: ${Number(escrow.collateralAmount) / (escrow.token === "0x0000000000000000000000000000000000000000" ? 1e18 : 1e6)}`
                  }
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowFundModal(false)}
                  className="flex-1 rounded-lg border border-[#154A99] px-4 py-2 text-[#D9AA90]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFund}
                  disabled={!fundAmount || isPending || isAllConfirming}
                  className="flex-1 rounded-lg bg-[#A65E46] px-4 py-2 text-white disabled:opacity-50"
                >
                  {isPending ? "Signing..." : isAllConfirming ? "Confirming..." : "Fund"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Commitment Modal */}
      {showDocumentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[#154A99] bg-[#07203F] p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Commit Documents</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-[#D9AA90]">Invoice Hash *</label>
                <input
                  type="text"
                  value={invoiceHash}
                  onChange={(e) => setInvoiceHash(e.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-lg border border-[#154A99] bg-[#0A2A52] px-3 py-2 text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[#D9AA90]">Bill of Lading Hash</label>
                <input
                  type="text"
                  value={bolHash}
                  onChange={(e) => setBolHash(e.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-lg border border-[#154A99] bg-[#0A2A52] px-3 py-2 text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[#D9AA90]">Packing List Hash</label>
                <input
                  type="text"
                  value={packingHash}
                  onChange={(e) => setPackingHash(e.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-lg border border-[#154A99] bg-[#0A2A52] px-3 py-2 text-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[#D9AA90]">Certificate of Origin Hash</label>
                <input
                  type="text"
                  value={cooHash}
                  onChange={(e) => setCooHash(e.target.value)}
                  placeholder="0x... (optional)"
                  className="w-full rounded-lg border border-[#154A99] bg-[#0A2A52] px-3 py-2 text-white font-mono text-xs"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDocumentModal(false)}
                  className="flex-1 rounded-lg border border-[#154A99] px-4 py-2 text-[#D9AA90]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCommitDocuments}
                  disabled={!invoiceHash || isPending || isAllConfirming}
                  className="flex-1 rounded-lg bg-[#1A5AB8] px-4 py-2 text-white disabled:opacity-50"
                >
                  {isPending ? "Signing..." : isAllConfirming ? "Confirming..." : "Commit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[#154A99] bg-[#07203F] p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Raise Dispute</h3>
            <p className="mb-4 text-sm text-[#D9AA90]">
              Are you sure you want to raise a dispute for this escrow? This will open a 14-day
              arbitration window.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDisputeModal(false)}
                className="flex-1 rounded-lg border border-[#154A99] px-4 py-2 text-[#D9AA90]"
              >
                Cancel
              </button>
              <button
                onClick={handleRaiseDispute}
                disabled={isPending || isAllConfirming}
                className="flex-1 rounded-lg bg-[#EF4444] px-4 py-2 text-white disabled:opacity-50"
              >
                {isPending ? "Signing..." : isAllConfirming ? "Confirming..." : "Raise Dispute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
