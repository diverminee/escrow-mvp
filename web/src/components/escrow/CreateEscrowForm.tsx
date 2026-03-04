"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAccount, useChainId } from "wagmi";
import { parseEther, isAddress, keccak256, encodeAbiParameters } from "viem";
import { useCreateEscrow } from "@/hooks/useCreateEscrow";
import { useUserStats } from "@/hooks/useUserStats";
import { useEscrowCount } from "@/hooks/useEscrowList";
import { useCheckEscrowRequirements } from "@/hooks/useCheckEscrowRequirements";
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
  
  // Form state - MUST be declared before any hooks that use these values
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
  
  // Custom hooks
  const { createEscrow, hash, isPending, isConfirming, isSuccess, error } = useCreateEscrow(chainId);
  const { tier, feeRate } = useUserStats(address, chainId);
  const { count: escrowCount } = useEscrowCount(chainId);
  
  // Auto-generate Trade ID based on escrow count (next escrow ID = current count)
  const autoTradeId = useMemo(() => {
    return escrowCount > 0 ? BigInt(escrowCount) + 1n : 1n;
  }, [escrowCount]);

  // Helper function to parse amount to Wei
  const parseAmountToWei = (tokenAddr: string, amountStr: string): bigint | null => {
    const tok = TOKENS.find(t => t.address === tokenAddr) || TOKENS[0];
    try {
      const decimals = Number(tok.decimals);
      const value = parseFloat(amountStr);
      if (isNaN(value) || value <= 0) return null;
      if (decimals === 18) {
        return parseEther(amountStr);
      }
      return BigInt(Math.floor(value * 10 ** decimals));
    } catch (e) {
      return null;
    }
  };

  // Helper function to generate trade data hash
  const generateTradeDataHash = (sellerAddr: string, arbiterAddr: string, tokenAddr: string, amountWei: bigint, tradeIdVal: bigint): `0x${string}` => {
    const hashInput = encodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "address" }, { type: "uint256" }, { type: "uint256" }],
      [sellerAddr as `0x${string}`, arbiterAddr as `0x${string}`, tokenAddr as `0x${string}`, amountWei, tradeIdVal]
    );
    return keccak256(hashInput);
  };

  // Auto-populate tradeId when modal opens (trade data hash will be generated on submit)
  useEffect(() => {
    if (isOpen && !tradeId) {
      setTradeId(autoTradeId.toString());
    }
  }, [isOpen, tradeId, autoTradeId]);

  // Pre-flight checks for KYC and contract status (moved after seller state)
  const { status: requirementStatus, getErrors, canCreateEscrow } = useCheckEscrowRequirements({
    buyerAddress: address,
    sellerAddress: seller && isAddress(seller) ? (seller as `0x${string}`) : undefined,
    chainId,
    enabled: !!address && !!seller && isAddress(seller),
  });
  
  // Determine if we can proceed with escrow creation
  const canProceed = canCreateEscrow() && !requirementStatus.isLoading;

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
    if (tradeDataHash && tradeDataHash !== "0x0" && tradeDataHash !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
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
      // Generate the trade data hash when moving to review step
      const amountWei = getAmountInWei();
      if (amountWei && seller && arbiter && tradeId) {
        const generatedHash = generateTradeDataHash(seller, arbiter, token, amountWei, BigInt(tradeId));
        setTradeDataHash(generatedHash);
      }
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
      <div 
        className="w-full max-w-lg rounded-lg border p-6 shadow-2xl"
        style={{ 
          borderColor: "var(--border-default)", 
          backgroundColor: "var(--bg-surface)" 
        }}
      >
            <div className="mb-4 flex items-center justify-between">
              <h2 
                className="text-xl font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {step === "form" && "Create Escrow"}
                {step === "review" && "Review Escrow"}
                {step === "success" && "Escrow Created!"}
              </h2>
              <button
                onClick={handleClose}
                className="transition hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            {step === "form" && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Mode Selection */}
                <div>
                  <label 
                    className="mb-2 block text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Escrow Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMode(EscrowMode.CASH_LOCK)}
                      className={`rounded-lg border p-3 text-left text-sm transition ${
                        mode === EscrowMode.CASH_LOCK
                          ? "border-[var(--border-bright)]"
                          : "border-[var(--border-default)] hover:border-[var(--border-bright)]"
                      }`}
                      style={{
                        backgroundColor: mode === EscrowMode.CASH_LOCK ? "var(--bg-elevated)" : "transparent",
                        color: "var(--text-primary)"
                      }}
                    >
                      <div className="font-medium">Cash Lock</div>
                      <div 
                        className="mt-1 text-xs" 
                        style={{ color: "var(--text-muted)" }}
                      >
                        Full amount locked
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode(EscrowMode.PAYMENT_COMMITMENT)}
                      className={`rounded-lg border p-3 text-left text-sm transition ${
                        mode === EscrowMode.PAYMENT_COMMITMENT
                          ? "border-[var(--border-bright)]"
                          : "border-[var(--border-default)] hover:border-[var(--border-bright)]"
                      }`}
                      style={{
                        backgroundColor: mode === EscrowMode.PAYMENT_COMMITMENT ? "var(--bg-elevated)" : "transparent",
                        color: "var(--text-primary)"
                      }}
                    >
                      <div className="font-medium">Payment Commitment</div>
                      <div 
                        className="mt-1 text-xs" 
                        style={{ color: "var(--text-muted)" }}
                      >
                        Partial collateral
                      </div>
                    </button>
                  </div>
                </div>

                {/* Seller */}
                <div>
                  <label 
                    className="mb-1 block text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Seller Address *
                  </label>
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
                    className="w-full rounded-lg border px-3 py-2 focus:outline-none"
                    style={{ 
                      borderColor: "var(--border-default)",
                      backgroundColor: "var(--bg-base)",
                      color: "var(--text-primary)",
                    }}
                    required
                  />
                  {errors.seller && (
                    <p className="mt-1 text-xs text-red-400">{errors.seller}</p>
                  )}
                </div>

                {/* Arbiter */}
                <div>
                  <label 
                    className="mb-1 block text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Arbiter Address *
                  </label>
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
                    className="w-full rounded-lg border px-3 py-2 focus:outline-none"
                    style={{ 
                      borderColor: "var(--border-default)",
                      backgroundColor: "var(--bg-base)",
                      color: "var(--text-primary)",
                    }}
                    required
                  />
                  {errors.arbiter && (
                    <p className="mt-1 text-xs text-red-400">{errors.arbiter}</p>
                  )}
                </div>

                {/* Token */}
                <div>
                  <label 
                    className="mb-1 block text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Token *
                  </label>
                  <select
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 focus:outline-none"
                    style={{ 
                      borderColor: "var(--border-default)",
                      backgroundColor: "var(--bg-base)",
                      color: "var(--text-primary)",
                    }}
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
                  <label 
                    className="mb-1 block text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Amount ({selectedToken.symbol}) *
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="any"
                    min="0"
                    className="w-full rounded-lg border px-3 py-2 focus:outline-none"
                    style={{ 
                      borderColor: "var(--border-default)",
                      backgroundColor: "var(--bg-base)",
                      color: "var(--text-primary)",
                    }}
                    required
                  />
                </div>

                {/* Payment Commitment Fields */}
                {mode === EscrowMode.PAYMENT_COMMITMENT && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label 
                          className="mb-1 block text-sm"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Collateral (BPS) *
                        </label>
                        <input
                          type="number"
                          value={collateralBps}
                          onChange={(e) => setCollateralBps(e.target.value)}
                          min={MIN_COLLATERAL_BPS.toString()}
                          max={MAX_COLLATERAL_BPS.toString()}
                          className="w-full rounded-lg border px-3 py-2 focus:outline-none"
                          style={{ 
                            borderColor: "var(--border-default)",
                            backgroundColor: "var(--bg-base)",
                            color: "var(--text-primary)",
                          }}
                          required
                        />
                        <p 
                          className="mt-1 text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {Number(collateralBps) / 100}% of amount
                        </p>
                      </div>
                      <div>
                        <label 
                          className="mb-1 block text-sm"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Maturity (days) *
                        </label>
                        <input
                          type="number"
                          value={maturityDays}
                          onChange={(e) => setMaturityDays(e.target.value)}
                          min="1"
                          className="w-full rounded-lg border px-3 py-2 focus:outline-none"
                          style={{ 
                            borderColor: "var(--border-default)",
                            backgroundColor: "var(--bg-base)",
                            color: "var(--text-primary)",
                          }}
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* User Info */}
                <div 
                  className="rounded-lg border p-3"
                  style={{ 
                    borderColor: "var(--border-default)",
                    backgroundColor: "var(--bg-subtle)"
                  }}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: "var(--text-secondary)" }}>Your Fee Rate:</span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {feeRate !== undefined ? formatFeeRate(feeRate) : "Loading..."}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span style={{ color: "var(--text-secondary)" }}>Your Tier:</span>
                    {tier !== undefined ? <TierBadge tier={tier} /> : <span style={{ color: "var(--text-muted)" }}>-</span>}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 rounded-lg border px-4 py-2 transition"
                    style={{ 
                      borderColor: "var(--border-default)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg px-4 py-2 text-white transition hover:opacity-90"
                    style={{ 
                      backgroundColor: "var(--accent)",
                    }}
                  >
                    Continue
                  </button>
                </div>
              </form>
            )}

            {step === "review" && (
              <div className="space-y-4">
                <div 
                  className="rounded-lg border p-4"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  <h3 
                    className="mb-3 text-sm font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Escrow Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-secondary)" }}>Mode:</span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {mode === EscrowMode.CASH_LOCK ? "Cash Lock" : "Payment Commitment"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-secondary)" }}>Seller:</span>
                      <AddressDisplay address={seller} />
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-secondary)" }}>Arbiter:</span>
                      <AddressDisplay address={arbiter} />
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-secondary)" }}>Token:</span>
                      <span style={{ color: "var(--text-primary)" }}>{selectedToken.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-secondary)" }}>Amount:</span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {amount} {selectedToken.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--text-secondary)" }}>Trade ID:</span>
                      <span style={{ color: "var(--text-primary)" }}>#{tradeId}</span>
                    </div>
                    {tradeDataHash && tradeDataHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                      <div className="flex flex-col">
                        <span style={{ color: "var(--text-secondary)" }}>Trade Data Hash:</span>
                        <span 
                          className="font-mono text-xs text-right" 
                          style={{ color: "var(--text-primary)" }}
                          title={tradeDataHash}
                        >
                          {tradeDataHash.slice(0, 18)}...{tradeDataHash.slice(-8)}
                        </span>
                      </div>
                    )}
                    {mode === EscrowMode.PAYMENT_COMMITMENT && (
                      <>
                        <div className="flex justify-between">
                          <span style={{ color: "var(--text-secondary)" }}>Collateral:</span>
                          <span style={{ color: "var(--text-primary)" }}>{Number(collateralBps) / 100}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: "var(--text-secondary)" }}>Maturity:</span>
                          <span style={{ color: "var(--text-primary)" }}>{maturityDays} days</span>
                        </div>
                      </>
                    )}
                    <div 
                      className="flex justify-between border-t pt-2"
                      style={{ borderColor: "var(--border-default)" }}
                    >
                      <span style={{ color: "var(--text-secondary)" }}>Fee Rate:</span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {feeRate !== undefined ? formatFeeRate(feeRate) : "Loading..."}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pre-flight requirement errors */}
                {requirementStatus.isLoading ? (
                  <div className="rounded-lg border border-yellow-800 bg-yellow-900/20 p-3 text-sm text-yellow-400">
                    Checking escrow requirements...
                  </div>
                ) : !canProceed && getErrors().length > 0 && (
                  <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
                    <p className="font-medium mb-1">Cannot create escrow:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {getErrors().map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Transaction error */}
                {error && (
                  <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
                    <p className="font-medium mb-1">Transaction Failed:</p>
                    <p>{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("form")}
                    className="flex-1 rounded-lg border px-4 py-2 transition"
                    style={{ 
                      borderColor: "var(--border-default)",
                      color: "var(--text-secondary)",
                    }}
                    disabled={isPending || isConfirming}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isPending || isConfirming || !canProceed}
                    className="flex-1 rounded-lg px-4 py-2 text-white transition hover:opacity-90 disabled:opacity-50"
                    style={{ 
                      backgroundColor: "var(--accent)",
                    }}
                  >
                    {isPending ? "Signing..." : isConfirming ? "Confirming..." : "Create Escrow"}
                  </button>
                </div>
              </div>
            )}

            {step === "success" && (
              <div className="space-y-4">
                <div 
                  className="rounded-lg border border-green-800 bg-green-900/20 p-4 text-center"
                  style={{ borderColor: "var(--green)" }}
                >
                  <div className="text-4xl" style={{ color: "var(--green)" }}>✓</div>
                  <p className="mt-2" style={{ color: "var(--text-primary)" }}>Escrow created successfully!</p>
                  {hash && (
                    <a
                      href={`https://basescan.org/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block text-sm hover:underline"
                      style={{ color: "var(--blue)" }}
                    >
                      View Transaction
                    </a>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  className="w-full rounded-lg px-4 py-2 text-white transition hover:opacity-90"
                  style={{ 
                    backgroundColor: "var(--accent)",
                  }}
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
        className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        style={{ backgroundColor: "var(--accent)" }}
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
