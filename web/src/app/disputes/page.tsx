"use client";

import { Header } from "@/components/layout/Header";

export default function DisputesPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-bold">Disputes</h1>
        <div className="rounded-lg border border-gray-800 p-12 text-center text-gray-500">
          <p>Dispute management interface coming soon.</p>
          <p className="mt-2 text-sm text-gray-600">
            Will list DISPUTED and ESCALATED escrows with resolution actions.
          </p>
        </div>
      </main>
    </div>
  );
}
