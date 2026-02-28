"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAccount, useChainId } from "wagmi";
import { parseEther, isAddress } from "viem";
import { useCreateEscrow } from "@/hooks/useCreateEscrow";
import { useUserStats } from "@/hooks/useUserStats";
import { EscrowMode } from "@/types/escrow";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { TierBadge } from "@/components/shared/TierBadge";
import { formatFeeRate } from "@/lib/utils";
import { DEFAULT_COLLATERAL_BPS, MIN_COLLATERAL_BPS, MAX_COLLATERAL_BPS, DEFAULT_MATURITY_DAYS } from "@/lib/constants";

interface CreateEscrowFormProps {
  onSuccess?: () => void;
}

// Supported tokens (hardcoded for now, could be dynamic)
const TOKENS = [
  { address: "0x0000000000000000000000000000000000000000", name: "ETH", symbol: "ETH", decimals: 18 },
  { address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", name: "USD Coin", symbol: "USDC", decimals: 6 },
  { address: "0xdac17f958d2ee523a2206206994597c13d831ec7", name: "Tether USD", symbol: "USDT", decimals: 6 },
];

// Modal component that renders outside the component hierarchy
function CreateEscrowModal({ 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess?: () => void; 
}) {
  // ALL hooks must be called unconditionally - no early returns before this point!
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  
  // Custom hooks
  const { createEscrow, hash, isPending, isConfirming, isSuccess, error } = useCreateEscrow(chainId);
  const { tier, feeRate } = useUserStats(address, chainId);

  // Form state
  const [mode, setMode] = useState<EscrowMode>(EscrowMode.CASH_LOCK);
  const [seller, setSeller] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [token, setToken] = useState(TOKENS[0].address);
  const [amount, setAmount] = useState("");
  const [tradeId, setTradeId] = useState("");
  const [tradeDataHash, setTradeDataHash] = useState("0x0000000000000000000000000000000000000000000000000000000000000000");
  const [collateralBps, setCollateralBps] = useState(DEFAULT_COLLATERAL_BPS.toString());
  const [maturityDays, setMaturityDays] = useState(DEFAULT_MATURITY_DAYS.toString());
  const [step, setStep] = useState<"form" | "review" | "success">("form");
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Effect to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // BUG FIX #1: Detect transaction success and transition to success step
  useEffect(() => {
    if (isSuccess && step !== "success") {
      setStep("success");
      if (onSuccess) {
        onSuccess();
      }
    }
  }, [isSuccess, step, onSuccess]);

  // Now we can do conditional returns - hooks are all called above
  if (!mounted) {
    return null;
  }

  const selectedToken = TOKENS.find(t => t.address === token) || TOKENS[0];

  // Parse amount based on token decimals
  const getAmountInWei = () => {
    try {
      const decimals = Number(selectedToken.decimals);
      const value = parseFloat(amount);
      if (isNaN(value) || value <= 0) return null;
      // Convert to proper units
      if (decimals === 18) {
        return parseEther(amount);
      }
      // For USDC/USDT (6 decimals)
      return BigInt(Math.floor(value * 10 ** decimals));
    } catch (e) {
      return null;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    const hashRegex = /^0x[0-9a-fA-F]{64}$/;
    
    // Validate seller address
    if (seller && !isAddress(seller)) {
      newErrors.seller = "Invalid Ethereum address";
    }
    
    // Validate arbiter address
    if (arbiter && !isAddress(arbiter)) {
      newErrors.arbiter = "Invalid Ethereum address";
    }
    
    // Cross-field validation: seller cannot be arbiter
    if (seller && arbiter && isAddress(seller) && isAddress(arbiter) && seller.toLowerCase() === arbiter.toLowerCase()) {
      newErrors.arbiter = "Arbiter cannot be the same as seller";
    }
    
    // Validate trade data hash format
    if (tradeDataHash && tradeDataHash !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      if (!hashRegex.test(tradeDataHash)) {
        newErrors.tradeDataHash = "Invalid hash format. Must be 0x followed by 64 hexadecimal characters.";
      }
    }
    
    // Validate trade ID
    if (tradeId && BigInt(tradeId) <= 0n) {
      newErrors.tradeId = "Trade ID must be greater than 0";
    }
    
    // Validate amount
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }
    
    // Validate collateral BPS for payment commitment mode
    if (mode === EscrowMode.PAYMENT_COMMITMENT) {
      const collateralValue = Number(collateralBps);
      if (collateralValue < Number(MIN_COLLATERAL_BPS) || collateralValue > Number(MAX_COLLATERAL_BPS)) {
        newErrors.collateralBps = `Collateral must be between ${Number(MIN_COLLATERAL_BPS)/100}% and ${Number(MAX_COLLATERAL_BPS)/100}%`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      setStep("review");
    }
  };

  const handleConfirm = () => {
    const amountWei = getAmountInWei();
    if (!amountWei || !seller || !arbiter || !tradeId) return;

    if (mode === EscrowMode.PAYMENT_COMMITMENT) {
      createEscrow({
        seller: seller as `0x${string}`,
        arbiter: arbiter as `0x${string}`,
        token: token as `0x${string}`,
        amount: amountWei,
        tradeId: BigInt(tradeId),
        tradeDataHash: tradeDataHash as `0x${string}`,
        mode: EscrowMode.PAYMENT_COMMITMENT,
        maturityDays: BigInt(maturityDays),
        collateralBps: BigInt(collateralBps),
      });
    } else {
      createEscrow({
        seller: seller as `0x${string}`,
        arbiter: arbiter as `0x${string}`,
        token: token as `0x${string}`,
        amount: amountWei,
        tradeId: BigInt(tradeId),
        tradeDataHash: tradeDataHash as `0x${string}`,
      });
    }
  };

  const handleClose = () => {
    onClose();
    setStep("form");
    setSeller("");
    setArbiter("");
    setAmount("");
    setTradeId("");
    setTradeDataHash("0x0000000000000000000000000000000000000000000000000000000000000000");
    setMode(EscrowMode.CASH_LOCK);
    setCollateralBps(DEFAULT_COLLATERAL_BPS.toString());
    setMaturityDays(DEFAULT_MATURITY_DAYS.toString());
  };

  if (!isConnected || !isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-auto">
      <div className="w-full max-w-lg rounded-lg border border-[#154A99] bg-[#07203F] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                {step === "form" && "Create Escrow"}
                {step === "review" && "Review Escrow"}
                {step === "success" && "Escrow Created!"}
              </h2>
              <button
                onClick={handleClose}
                className="text-[#A68A7A] hover:text-white"
              >
                ✕
              </button>
            </div>

            {step === "form" && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Mode Selection */}
                <div>
                  <label className="mb-2 block text-sm text-[#D9AA90]">Escrow Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMode(EscrowMode.CASH_LOCK)}
                      className={`rounded-lg border p-3 text-left text-sm transition ${
                        mode === EscrowMode.CASH_LOCK
                          ? "border-[#1A5AB8] bg-[#0A2A52] text-white"
                          : "border-[#154A99] text-[#D9AA90] hover:border-[#1A5AB8]"
                      }`}
                    >
                      <div className="font-medium">Cash Lock</div>
                      <div className="mt-1 text-xs text-[#A68A7A]">Full amount locked</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode(EscrowMode.PAYMENT_COMMITMENT)}
                      className={`rounded-lg border p-3 text-left text-sm transition ${
                        mode === EscrowMode.PAYMENT_COMMITMENT
                          ? "border-[#1A5AB8] bg-[#0A2A52] text-white"
                          : "border-[#154A99] text-[#D9AA90] hover:border-[#1A5AB8]"
                      }`}
                    >
                      <div className="font-medium">Payment Commitment</div>
                      <div className="mt-1 text-xs text-[#A68A7A]">Partial collateral</div>
                    </button>
                  </div>
                </div>

                {/* Seller */}
                <div>
                  <label className="mb-1 block text-sm text-[#D9AA90]">Seller Address *</label>
                  <input
                    type="text"
                    value={seller}
                    onChange={(e) => {
                      setSeller(e.target.value);
                      // Clear error when user types
                      if (errors.seller) {
                        setErrors(prev => ({ ...prev, seller: "" }));
                      }
                    }}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white placeholder-[#A68A7A] focus:border-[#A65E46] focus:outline-none"
                    required
                  />
                  {errors.seller && (
                    <p className="mt-1 text-xs text-red-400">{errors.seller}</p>
                  )}
                </div>

                {/* Arbiter */}
                <div>
                  <label className="mb-1 block text-sm text-[#D9AA90]">Arbiter Address *</label>
                  <input
                    type="text"
                    value={arbiter}
                    onChange={(e) => {
                      setArbiter(e.target.value);
                      // Clear error when user types
                      if (errors.arbiter) {
                        setErrors(prev => ({ ...prev, arbiter: "" }));
                      }
                    }}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white placeholder-[#A68A7A] focus:border-[#A65E46] focus:outline-none"
                    required
                  />
                  {errors.arbiter && (
                    <p className="mt-1 text-xs text-red-400">{errors.arbiter}</p>
                  )}
                </div>

                {/* Token */}
                <div>
                  <label className="mb-1 block text-sm text-[#D9AA90]">Token *</label>
                  <select
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white focus:border-[#A65E46] focus:outline-none"
                    required
                  >
                    {TOKENS.map((t) => (
                      <option key={t.address} value={t.address}>
                        {t.name} ({t.symbol})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="mb-1 block text-sm text-[#D9AA90]">
                    Amount ({selectedToken.symbol}) *
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="any"
                    min="0"
                    className="w-full rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white placeholder-[#A68A7A] focus:border-[#A65E46] focus:outline-none"
                    required
                  />
                </div>

                {/* Trade ID */}
                <div>
                  <label className="mb-1 block text-sm text-[#D9AA90]">Trade ID *</label>
                  <input
                    type="number"
                    value={tradeId}
                    onChange={(e) => setTradeId(e.target.value)}
                    placeholder="1"
                    min="1"
                    className="w-full rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white placeholder-[#A68A7A] focus:border-[#A65E46] focus:outline-none"
                    required
                  />
                </div>

                {/* Trade Data Hash */}
                <div>
                  <label className="mb-1 block text-sm text-[#D9AA90]">Trade Data Hash</label>
                  <input
                    type="text"
                    value={tradeDataHash}
                    onChange={(e) => setTradeDataHash(e.target.value)}
                    placeholder="0x0000000000000000000000000000000000000000000000000000000000000000"
                    className="w-full rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white placeholder-[#A68A7A] focus:border-[#A65E46] focus:outline-none font-mono text-xs"
                  />
                  {errors.tradeDataHash && (
                    <p className="mt-1 text-xs text-red-400">{errors.tradeDataHash}</p>
                  )}
                </div>

                {/* Payment Commitment Fields */}
                {mode === EscrowMode.PAYMENT_COMMITMENT && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-sm text-[#D9AA90]">
                          Collateral (BPS) *
                        </label>
                        <input
                          type="number"
                          value={collateralBps}
                          onChange={(e) => setCollateralBps(e.target.value)}
                          min={MIN_COLLATERAL_BPS.toString()}
                          max={MAX_COLLATERAL_BPS.toString()}
                          className="w-full rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white focus:border-[#A65E46] focus:outline-none"
                          required
                        />
                        <p className="mt-1 text-xs text-[#A68A7A]">
                          {Number(collateralBps) / 100}% of amount
                        </p>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-[#D9AA90]">
                          Maturity (days) *
                        </label>
                        <input
                          type="number"
                          value={maturityDays}
                          onChange={(e) => setMaturityDays(e.target.value)}
                          min="1"
                          className="w-full rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white focus:border-[#A65E46] focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* User Info */}
                <div className="rounded-lg border border-[#154A99] bg-[#07203F]/50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#D9AA90]">Your Fee Rate:</span>
                    <span className="text-white">
                      {feeRate !== undefined ? formatFeeRate(feeRate) : "Loading..."}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-[#D9AA90]">Your Tier:</span>
                    {tier !== undefined ? <TierBadge tier={tier} /> : <span className="text-[#A68A7A]">-</span>}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 rounded-lg border border-[#154A99] px-4 py-2 text-[#D9AA90] transition hover:border-[#A65E46] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-[#A65E46] px-4 py-2 text-white transition hover:bg-[#C47154]"
                  >
                    Continue
                  </button>
                </div>
              </form>
            )}

            {step === "review" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-[#154A99] p-4">
                  <h3 className="mb-3 text-sm font-medium text-[#D9AA90]">Escrow Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#D9AA90]">Mode:</span>
                      <span className="text-white">
                        {mode === EscrowMode.CASH_LOCK ? "Cash Lock" : "Payment Commitment"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#D9AA90]">Seller:</span>
                      <AddressDisplay address={seller} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#D9AA90]">Arbiter:</span>
                      <AddressDisplay address={arbiter} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#D9AA90]">Token:</span>
                      <span className="text-white">{selectedToken.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#D9AA90]">Amount:</span>
                      <span className="text-white">
                        {amount} {selectedToken.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#D9AA90]">Trade ID:</span>
                      <span className="text-white">#{tradeId}</span>
                    </div>
                    {mode === EscrowMode.PAYMENT_COMMITMENT && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-[#D9AA90]">Collateral:</span>
                          <span className="text-white">{Number(collateralBps) / 100}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#D9AA90]">Maturity:</span>
                          <span className="text-white">{maturityDays} days</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between border-t border-[#154A99] pt-2">
                      <span className="text-[#D9AA90]">Fee Rate:</span>
                      <span className="text-white">
                        {feeRate !== undefined ? formatFeeRate(feeRate) : "Loading..."}
                      </span>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
                    Error: {error.message}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("form")}
                    className="flex-1 rounded-lg border border-[#154A99] px-4 py-2 text-[#D9AA90] transition hover:border-[#A65E46] hover:text-white"
                    disabled={isPending || isConfirming}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isPending || isConfirming}
                    className="flex-1 rounded-lg bg-[#A65E46] px-4 py-2 text-white transition hover:bg-[#C47154] disabled:opacity-50"
                  >
                    {isPending ? "Signing..." : isConfirming ? "Confirming..." : "Create Escrow"}
                  </button>
                </div>
              </div>
            )}

            {step === "success" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-800 bg-green-900/20 p-4 text-center">
                  <div className="text-4xl">✓</div>
                  <p className="mt-2 text-white">Escrow created successfully!</p>
                  {hash && (
                    <a
                      href={`https://basescan.org/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block text-sm text-[#1A5AB8] hover:underline"
                    >
                      View Transaction
                    </a>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  className="w-full rounded-lg bg-[#A65E46] px-4 py-2 text-white transition hover:bg-[#C47154]"
                >
                  Done
                </button>
              </div>
            )}
      </div>
    </div>
  );
}

export function CreateEscrowForm({ onSuccess }: CreateEscrowFormProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded-lg bg-[#A65E46] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#C47154]"
      >
        Create Escrow
      </button>
      
      {/* Render modal using portal to ensure it's outside the component hierarchy */}
      {typeof window !== 'undefined' && createPortal(
        <CreateEscrowModal 
          isOpen={isOpen} 
          onClose={handleClose} 
          onSuccess={onSuccess} 
        />,
        document.body
      )}
    </>
  );
}
