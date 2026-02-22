"use client";

import { useParams } from "next/navigation";
import { useChainId, useAccount } from "wagmi";
import { useEscrowRead } from "@/hooks/useEscrowRead";
import { Header } from "@/components/layout/Header";
import { StateChip } from "@/components/shared/StateChip";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { TokenAmount } from "@/components/shared/TokenAmount";
import { modeToLabel, formatTimestamp } from "@/lib/utils";

export default function EscrowDetailPage() {
  const params = useParams();
  const escrowId = BigInt(params.id as string);
  const chainId = useChainId();
  const { address } = useAccount();

  const { escrow, documents, isLoading, isError } = useEscrowRead(
    escrowId,
    chainId
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-bold">Escrow #{String(escrowId)}</h1>

        {isLoading && <p className="text-gray-500">Loading...</p>}
        {isError && <p className="text-red-400">Failed to load escrow</p>}

        {escrow && (
          <div className="space-y-6">
            {/* Status */}
            <div className="flex items-center gap-4">
              <StateChip state={Number(escrow.state)} />
              <span className="text-sm text-gray-500">
                {modeToLabel(Number(escrow.mode))}
              </span>
            </div>

            {/* Parties */}
            <section className="rounded-lg border border-gray-800 p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-500">
                Parties
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-gray-600">Buyer</p>
                  <AddressDisplay address={escrow.buyer} />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Seller</p>
                  <AddressDisplay address={escrow.seller} />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Arbiter</p>
                  <AddressDisplay address={escrow.arbiter} />
                </div>
              </div>
            </section>

            {/* Financials */}
            <section className="rounded-lg border border-gray-800 p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-500">
                Financials
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Amount</p>
                  <TokenAmount amount={escrow.amount} token={escrow.token} />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Collateral</p>
                  <TokenAmount
                    amount={escrow.collateralAmount}
                    token={escrow.token}
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Fee Rate</p>
                  <span className="font-mono">
                    {(Number(escrow.feeRate) / 10).toFixed(1)}%
                  </span>
                </div>
                {escrow.maturityDate > 0n && (
                  <div>
                    <p className="text-xs text-gray-600">Maturity</p>
                    <span className="text-sm">
                      {formatTimestamp(escrow.maturityDate)}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Documents */}
            {documents && documents.committedAt > 0n && (
              <section className="rounded-lg border border-gray-800 p-4">
                <h2 className="mb-3 text-sm font-semibold text-gray-500">
                  Documents
                </h2>
                <p className="font-mono text-xs text-gray-400 break-all">
                  Merkle Root: {documents.merkleRoot}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Committed: {formatTimestamp(documents.committedAt)}
                </p>
              </section>
            )}

            {/* Actions placeholder */}
            <section className="rounded-lg border border-dashed border-gray-700 p-4 text-center text-sm text-gray-600">
              Action buttons (fund, confirm, dispute, etc.) will be rendered
              here based on escrow state and connected user role.
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
