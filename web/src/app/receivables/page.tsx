"use client";

import { Header } from "@/components/layout/Header";

export default function ReceivablesPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-bold">Receivables</h1>
        <div className="rounded-lg border border-gray-800 p-12 text-center text-gray-500">
          <p>ERC-721 receivable NFT browser coming soon.</p>
          <p className="mt-2 text-sm text-gray-600">
            Will display tokenized trade receivables minted from Payment
            Commitment escrows.
          </p>
        </div>
      </main>
    </div>
  );
}
