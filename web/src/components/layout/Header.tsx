"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

export function Header() {

  return (
    <header 
      className="sticky top-0 z-40 border-b border-[var(--border-default)]"
      style={{ 
        background: "var(--bg-surface)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex h-16 items-center justify-between px-4">
        {/* Left: Logo + Brand - Uniswap style */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            {/* Logo Icon */}
            <div 
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{ 
                background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-dim) 100%)",
              }}
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M12 2L4 6V12C4 16.42 7.42 20.74 12 22C16.58 20.74 20 16.42 20 12V6L12 2Z" 
                  fill="white" 
                  fillOpacity="0.9"
                />
                <path 
                  d="M10 12L12 14L16 10" 
                  stroke="white" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            
            {/* Brand Text - Uniswap style */}
            <div className="flex flex-col">
              <span 
                className="text-lg font-semibold leading-none"
                style={{ 
                  color: "var(--text-primary)",
                  fontFamily: "'Playfair Display', serif"
                }}
              >
                Credence
              </span>
              <div className="flex items-center gap-1">
                <span 
                  className="text-[10px] font-medium leading-tight"
                  style={{ 
                    color: "var(--text-muted)",
                  }}
                >
                  Trustless Trade
                </span>
                <span 
                  className="text-[10px] font-medium leading-tight"
                  style={{ 
                    color: "var(--text-muted)",
                  }}
                >
                  Infrastructure
                </span>
              </div>
            </div>
          </Link>

          {/* Navigation - Uniswap style, closer to logo */}
          <nav className="hidden lg:flex items-center ml-8">
            {[
              { href: "/", label: "Dashboard" },
              { href: "/disputes", label: "Disputes" },
              { href: "/receivables", label: "Receivables" },
              { href: "/admin", label: "Admin" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{ 
                  color: "var(--text-secondary)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-subtle)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Section - Uniswap style */}
        <div className="flex items-center gap-2">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
