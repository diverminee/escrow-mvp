"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId } from "wagmi";
import { parseEther } from "viem";
import { useAdmin, useIsOwner, useContractState } from "@/hooks/useAdmin";
import { AddressDisplay } from "@/components/shared/AddressDisplay";

const TIER_NAMES = ["TESTNET", "LAUNCH", "GROWTH", "MATURITY"];

export function AdminPanel() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isOwner = useIsOwner();
  const { isPaused, owner, tier } = useContractState();
  const admin = useAdmin();

  // All state hooks must be at the top, before any early returns
  const [activeTab, setActiveTab] = useState<"kyc" | "tokens" | "tier" | "settings" | "emergency">("kyc");

  // KYC State
  const [kycAddress, setKycAddress] = useState("");
  const [kycBatch, setKycBatch] = useState("");

  // Token State
  const [tokenAddress, setTokenAddress] = useState("");

  // Tier State
  const [maxAmount, setMaxAmount] = useState("");
  const [minAmount, setMinAmount] = useState("");

  // Settings State
  const [feeRecipient, setFeeRecipient] = useState("");
  const [protocolArbiter, setProtocolArbiter] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="rounded-lg border border-[#154A99] p-8 text-center text-[#A68A7A]">
        Loading admin panel...
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-[#154A99] p-8 text-center text-[#A68A7A]">
        Connect your wallet to access admin panel
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-8 text-center text-red-400">
        Access Denied: Only the contract owner can access this panel
        {owner && (
          <p className="mt-2 text-sm text-[#A68A7A]">
            Contract Owner: <AddressDisplay address={owner} />
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contract Status */}
      <div className="rounded-lg border border-[#154A99] bg-[#07203F]/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-[#D9AA90]">Contract Status</h3>
            <div className="mt-2 flex items-center gap-4">
              <span className={`text-sm ${isPaused ? "text-red-400" : "text-green-400"}`}>
                {isPaused ? "PAUSED" : "ACTIVE"}
              </span>
              <span className="text-sm text-[#A68A7A]">
                Tier: <span className="text-white">{tier !== undefined ? TIER_NAMES[tier] : "..."}</span>
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {!isPaused ? (
              <button
                onClick={() => admin.pause()}
                disabled={admin.isPending || admin.isConfirming}
                className="rounded-lg bg-[#A65E46] px-4 py-2 text-sm text-white transition hover:bg-[#C47154] disabled:opacity-50"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={() => admin.unpause()}
                disabled={admin.isPending || admin.isConfirming}
                className="rounded-lg bg-[#22C55E] px-4 py-2 text-sm text-white transition hover:bg-[#16a34a] disabled:opacity-50"
              >
                Unpause
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#154A99]">
        {(["kyc", "tokens", "tier", "settings", "emergency"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === tab
                ? "border-b-2 border-[#1A5AB8] text-white"
                : "text-[#D9AA90] hover:text-white"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border border-[#154A99] p-6">
        {admin.error && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
            Error: {admin.error.message}
          </div>
        )}

        {/* KYC Tab */}
        {activeTab === "kyc" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">KYC Management</h3>
            
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-[#D9AA90]">Single Address</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={kycAddress}
                    onChange={(e) => setKycAddress(e.target.value)}
                    placeholder="0x..."
                    className="flex-1 rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white"
                  />
                  <button
                    onClick={() => {
                      admin.setKYCStatus(kycAddress as `0x${string}`, true);
                      setKycAddress("");
                    }}
                    disabled={!kycAddress || admin.isPending}
                    className="rounded-lg bg-[#22C55E] px-4 py-2 text-white disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      admin.setKYCStatus(kycAddress as `0x${string}`, false);
                      setKycAddress("");
                    }}
                    disabled={!kycAddress || admin.isPending}
                    className="rounded-lg bg-[#A65E46] px-4 py-2 text-white disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-[#D9AA90]">Batch Addresses (comma-separated)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={kycBatch}
                    onChange={(e) => setKycBatch(e.target.value)}
                    placeholder="0x..., 0x..., 0x..."
                    className="flex-1 rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white"
                  />
                  <button
                    onClick={() => {
                      const addresses = kycBatch.split(",").map((a) => a.trim()).filter(Boolean);
                      admin.batchSetKYCStatus(addresses as `0x${string}`[], true);
                      setKycBatch("");
                    }}
                    disabled={!kycBatch || admin.isPending}
                    className="rounded-lg bg-[#22C55E] px-4 py-2 text-white disabled:opacity-50"
                  >
                    Batch Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tokens Tab */}
        {activeTab === "tokens" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Token Management</h3>
            
            <div>
              <label className="mb-1 block text-sm text-[#D9AA90]">Token Address</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  placeholder="0x..."
                  className="flex-1 rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white"
                />
                <button
                  onClick={() => {
                    admin.addApprovedToken(tokenAddress as `0x${string}`);
                    setTokenAddress("");
                  }}
                  disabled={!tokenAddress || admin.isPending}
                  className="rounded-lg bg-[#22C55E] px-4 py-2 text-white disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    admin.removeApprovedToken(tokenAddress as `0x${string}`);
                    setTokenAddress("");
                  }}
                  disabled={!tokenAddress || admin.isPending}
                  className="rounded-lg bg-[#A65E46] px-4 py-2 text-white disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tier Tab */}
        {activeTab === "tier" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Deployment Tier</h3>
            
            <div className="grid grid-cols-2 gap-4">
              {([1, 2, 3] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => admin.upgradeTier(t)}
                  disabled={tier !== undefined && t <= tier}
                  className="rounded-lg border border-[#154A99] bg-[#07203F] p-4 text-left transition hover:border-[#1A5AB8] disabled:opacity-50"
                >
                  <div className="font-medium text-white">{TIER_NAMES[t]}</div>
                  <div className="text-sm text-[#A68A7A]">
                    {tier !== undefined && t <= tier ? "Current" : `Upgrade to ${TIER_NAMES[t]}`}
                  </div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div>
                <label className="mb-1 block text-sm text-[#D9AA90]">Max Escrow Amount (ETH)</label>
                <input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white"
                />
                <button
                  onClick={() => maxAmount && admin.setMaxEscrowAmount(parseEther(maxAmount))}
                  disabled={!maxAmount || admin.isPending}
                  className="mt-2 w-full rounded-lg bg-[#1A5AB8] px-4 py-2 text-white disabled:opacity-50"
                >
                  Set Max
                </button>
              </div>
              <div>
                <label className="mb-1 block text-sm text-[#D9AA90]">Min Escrow Amount (ETH)</label>
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white"
                />
                <button
                  onClick={() => minAmount && admin.setMinEscrowAmount(parseEther(minAmount))}
                  disabled={!minAmount || admin.isPending}
                  className="mt-2 w-full rounded-lg bg-[#1A5AB8] px-4 py-2 text-white disabled:opacity-50"
                >
                  Set Min
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Protocol Settings</h3>
            
            <div>
              <label className="mb-1 block text-sm text-[#D9AA90]">Fee Recipient</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={feeRecipient}
                  onChange={(e) => setFeeRecipient(e.target.value)}
                  placeholder="0x..."
                  className="flex-1 rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white"
                />
                <button
                  onClick={() => {
                    admin.setFeeRecipient(feeRecipient as `0x${string}`);
                    setFeeRecipient("");
                  }}
                  disabled={!feeRecipient || admin.isPending}
                  className="rounded-lg bg-[#1A5AB8] px-4 py-2 text-white disabled:opacity-50"
                >
                  Update
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-[#D9AA90]">Protocol Arbiter</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={protocolArbiter}
                  onChange={(e) => setProtocolArbiter(e.target.value)}
                  placeholder="0x..."
                  className="flex-1 rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white"
                />
                <button
                  onClick={() => {
                    admin.setProtocolArbiter(protocolArbiter as `0x${string}`);
                    setProtocolArbiter("");
                  }}
                  disabled={!protocolArbiter || admin.isPending}
                  className="rounded-lg bg-[#1A5AB8] px-4 py-2 text-white disabled:opacity-50"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Emergency Tab */}
        {activeTab === "emergency" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Emergency Controls</h3>
            <p className="text-sm text-[#A68A7A]">
              Use pause to halt new escrow creation and funding in case of emergency.
              Settlement and dispute resolution remain functional.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => admin.pause()}
                disabled={isPaused || admin.isPending}
                className="rounded-lg bg-[#A65E46] px-6 py-3 text-white transition hover:bg-[#C47154] disabled:opacity-50"
              >
                Pause Contract
              </button>
              <button
                onClick={() => admin.unpause()}
                disabled={!isPaused || admin.isPending}
                className="rounded-lg bg-[#22C55E] px-6 py-3 text-white transition hover:bg-[#16a34a] disabled:opacity-50"
              >
                Unpause Contract
              </button>
            </div>
          </div>
        )}

        {admin.isPending && (
          <p className="mt-4 text-sm text-[#A68A7A]">Transaction pending...</p>
        )}
        {admin.isConfirming && (
          <p className="mt-4 text-sm text-[#A68A7A]">Confirming transaction...</p>
        )}
      </div>
    </div>
  );
}
