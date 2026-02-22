"use client";

import { useAccount, useChainId } from "wagmi";
import { useEscrowCount } from "@/hooks/useEscrowRead";
import { useUserStats } from "@/hooks/useUserStats";
import { Header } from "@/components/layout/Header";
import { TierBadge } from "@/components/shared/TierBadge";
import { formatFeeRate } from "@/lib/utils";
import Link from "next/link";

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: escrowCount } = useEscrowCount(chainId);
  const { stats, tier, feeRate, isLoading } = useUserStats(address, chainId);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-8 text-3xl font-bold">Dashboard</h1>

        {!isConnected ? (
          <div className="rounded-lg border border-gray-800 p-12 text-center">
            <p className="text-lg text-gray-400">
              Connect your wallet to get started
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* User Stats */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-gray-800 p-4">
                <p className="text-sm text-gray-500">Tier</p>
                <div className="mt-1">
                  {tier !== undefined ? (
                    <TierBadge tier={tier} />
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-gray-800 p-4">
                <p className="text-sm text-gray-500">Successful Trades</p>
                <p className="mt-1 text-2xl font-bold">
                  {stats ? String(stats[0]) : "-"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 p-4">
                <p className="text-sm text-gray-500">Disputes Lost</p>
                <p className="mt-1 text-2xl font-bold">
                  {stats ? String(stats[2]) : "-"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 p-4">
                <p className="text-sm text-gray-500">Fee Rate</p>
                <p className="mt-1 text-2xl font-bold">
                  {feeRate !== undefined ? formatFeeRate(feeRate) : "-"}
                </p>
              </div>
            </section>

            {/* Escrow Overview */}
            <section className="rounded-lg border border-gray-800 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Escrows</h2>
                <p className="text-sm text-gray-500">
                  Total created:{" "}
                  {escrowCount !== undefined ? String(escrowCount) : "-"}
                </p>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                Escrow list view coming soon. Use{" "}
                <Link
                  href="/escrow/0"
                  className="text-blue-400 hover:underline"
                >
                  /escrow/[id]
                </Link>{" "}
                to view a specific escrow.
              </p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
