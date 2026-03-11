"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId } from "wagmi";
import { parseEther } from "viem";
import { useAdmin, useIsOwner, useContractState } from "@/hooks/useAdmin";
import { useKYC } from "@/hooks/useKYC";
import { AddressDisplay } from "@/components/shared/AddressDisplay";

const TIER_NAMES = ["TESTNET", "LAUNCH", "GROWTH", "MATURITY"];

export function AdminPanel() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isOwner = useIsOwner();
  const { isPaused, owner, tier } = useContractState();
  const admin = useAdmin();
  const kyc = useKYC();

  // All state hooks must be at the top, before any early returns
  const [activeTab, setActiveTab] = useState<"KYC" | "tokens" | "tier" | "settings" | "emergency">("KYC");

  // KYC State
  const [kycSubTab, setKycSubTab] = useState<"verified" | "manual">("verified");
  const [manualAddress, setManualAddress] = useState("");
  const [manualBatch, setManualBatch] = useState("");
  const [revokingAddress, setRevokingAddress] = useState<string | null>(null);

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
        {(["KYC", "tokens", "tier", "settings", "emergency"] as const).map((tab) => (
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
        {activeTab === "KYC" && (
          <div className="space-y-6">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">KYC Management</h3>
              <span className="text-xs text-[#A68A7A]">
                {kyc.approvedCount} address{kyc.approvedCount !== 1 ? "es" : ""} verified
              </span>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 rounded-lg border border-[#154A99] bg-[#07203F]/50 p-1">
              <button
                onClick={() => setKycSubTab("verified")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  kycSubTab === "verified"
                    ? "bg-[#1A5AB8] text-white"
                    : "text-[#A68A7A] hover:text-white"
                }`}
              >
                Verified ({kyc.approvedCount})
              </button>
              <button
                onClick={() => setKycSubTab("manual")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  kycSubTab === "manual"
                    ? "bg-[#1A5AB8] text-white"
                    : "text-[#A68A7A] hover:text-white"
                }`}
              >
                Manual Override
              </button>
            </div>

            {/* Verified List */}
            {kycSubTab === "verified" && (
              <div className="space-y-3">
                <p className="text-xs text-[#A68A7A]">
                  All addresses with active KYC approval. Users self-verify by signing the Terms of Service in the header. Revoke if a wallet is flagged or compromised.
                </p>

                {kyc.approvedAddresses.length === 0 ? (
                  <div className="rounded-lg border border-[#154A99] bg-[#07203F]/30 p-8 text-center text-sm text-[#A68A7A]">
                    No verified addresses yet.
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#154A99] overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#154A99] bg-[#07203F]/50 px-4 py-2">
                      <span className="text-xs font-medium uppercase tracking-wider text-[#A68A7A]">Address</span>
                      <span className="text-xs font-medium uppercase tracking-wider text-[#A68A7A]">Action</span>
                    </div>
                    <div className="divide-y divide-[#154A99]">
                      {kyc.approvedAddresses.map((addr) => (
                        <div key={addr} className="grid grid-cols-[1fr_auto] gap-4 items-center px-4 py-3">
                          <AddressDisplay address={addr as `0x${string}`} />
                          <button
                            onClick={() => {
                              setRevokingAddress(addr);
                              admin.setKYCStatus(addr as `0x${string}`, false);
                            }}
                            disabled={admin.isPending && revokingAddress === addr}
                            className="rounded-lg border border-[#A65E46] px-3 py-1.5 text-xs font-medium text-[#A65E46] transition hover:bg-[#A65E46] hover:text-white disabled:opacity-50"
                          >
                            {admin.isPending && revokingAddress === addr ? "Revoking..." : "Revoke"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => kyc.refetch.approvedList()}
                  className="text-xs text-[#A68A7A] hover:text-white transition"
                >
                  ↻ Refresh list
                </button>
              </div>
            )}

            {/* Manual Override */}
            {kycSubTab === "manual" && (
              <div className="space-y-6">
                <p className="text-xs text-[#A68A7A]">
                  Directly approve addresses without requiring them to sign the ToS. Use for test wallets, institutional users, or emergency access.
                </p>

                {/* Single address */}
                <div className="space-y-2">
                  <label className="block text-sm text-[#D9AA90]">Single Address</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      placeholder="0x..."
                      className="flex-1 rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white font-mono text-sm"
                    />
                    <button
                      onClick={() => {
                        admin.setKYCStatus(manualAddress as `0x${string}`, true);
                        setManualAddress("");
                      }}
                      disabled={!manualAddress || admin.isPending}
                      className="rounded-lg bg-[#22C55E] px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        admin.setKYCStatus(manualAddress as `0x${string}`, false);
                        setManualAddress("");
                      }}
                      disabled={!manualAddress || admin.isPending}
                      className="rounded-lg bg-[#A65E46] px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                </div>

                {/* Batch */}
                <div className="space-y-2">
                  <label className="block text-sm text-[#D9AA90]">Batch Approve (comma-separated)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualBatch}
                      onChange={(e) => setManualBatch(e.target.value)}
                      placeholder="0x..., 0x..., 0x..."
                      className="flex-1 rounded-lg border border-[#154A99] bg-[#07203F] px-3 py-2 text-white font-mono text-sm"
                    />
                    <button
                      onClick={() => {
                        const addresses = manualBatch
                          .split(",")
                          .map((a) => a.trim())
                          .filter(Boolean);
                        admin.batchSetKYCStatus(addresses as `0x${string}`[], true);
                        setManualBatch("");
                      }}
                      disabled={!manualBatch || admin.isPending}
                      className="rounded-lg bg-[#1A5AB8] px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Batch Approve
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Transaction feedback */}
            {admin.isPending && (
              <p className="text-xs text-[#A68A7A]">Waiting for signature...</p>
            )}
            {admin.isConfirming && (
              <p className="text-xs text-[#A68A7A]">Confirming transaction...</p>
            )}
            {admin.isSuccess && (
              <p className="text-xs text-green-400">Transaction confirmed.</p>
            )}
            {admin.error && (
              <p className="text-xs text-red-400">Error: {admin.error.message}</p>
            )}
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
