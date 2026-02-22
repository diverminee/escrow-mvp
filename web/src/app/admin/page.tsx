"use client";

import { Header } from "@/components/layout/Header";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-bold">Admin</h1>
        <div className="rounded-lg border border-gray-800 p-12 text-center text-gray-500">
          <p>Admin panel coming soon.</p>
          <p className="mt-2 text-sm text-gray-600">
            KYC management, token allowlisting, tier upgrades, and protocol
            settings.
          </p>
        </div>
      </main>
    </div>
  );
}
