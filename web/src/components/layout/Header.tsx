"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-xl font-bold text-white">
          Credence
        </Link>
        <nav className="flex gap-6 text-sm text-gray-400">
          <Link href="/" className="transition hover:text-white">
            Dashboard
          </Link>
          <Link href="/disputes" className="transition hover:text-white">
            Disputes
          </Link>
          <Link href="/receivables" className="transition hover:text-white">
            Receivables
          </Link>
          <Link href="/admin" className="transition hover:text-white">
            Admin
          </Link>
        </nav>
      </div>
      <ConnectButton />
    </header>
  );
}
