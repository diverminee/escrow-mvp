"use client";

import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useThemeToggle } from "@/components/providers/ThemeProvider";
import { NetworkSelector } from "@/components/shared/NetworkSelector";
import { useIsOwner, useKYCStatus } from "@/hooks/useAdmin";
import { useKYC } from "@/hooks/useKYC";
import { useState, useEffect, useRef } from "react";

// Custom connected account display component
function AccountDisplay() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const isOwner = useIsOwner();
  const { isKYCApproved, isKYCRequested } = useKYCStatus(address);
  const { status, requestKYC, isPending } = useKYC();
  const [mounted, setMounted] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!mounted || !isConnected || !address) return null;

  // Truncate address for display
  const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
    setIsDropdownOpen(false);
  };

  const handleDisconnect = () => {
    disconnect();
    setIsDropdownOpen(false);
  };

  return (
    <div className="flex items-center gap-2" ref={dropdownRef}>
      {/* Network Selector */}
      <NetworkSelector />
      
      {/* Account Button with Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all hover:bg-[var(--bg-elevated)]"
          style={{ 
            borderColor: "var(--border-default)",
            backgroundColor: "var(--bg-surface)",
          }}
          title="Click to open options"
        >
          {/* Wallet icon */}
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="var(--text-secondary)" 
            strokeWidth="2"
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
          
          {/* Address */}
          <span 
            className="text-xs font-medium"
            style={{ 
              fontFamily: "'IBM Plex Mono', monospace",
              color: "var(--text-primary)",
            }}
          >
            {truncatedAddress}
          </span>
          
          {/* Chevron down icon */}
          <svg 
            width="12" 
            height="12" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="var(--text-muted)" 
            strokeWidth="2"
            strokeLinecap="round" 
            strokeLinejoin="round"
            className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div 
            className="absolute right-0 mt-2 w-56 rounded-lg border shadow-lg z-50"
            style={{ 
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-default)",
            }}
          >
            {/* KYC Status */}
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-dim)" }}>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>KYC Status</span>
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {isOwner === true ? "Owner" : isKYCApproved === true ? "Verified" : isKYCRequested === true ? "Pending" : "Not Verified"}
              </div>
            </div>

            {/* Request KYC Button - Only show for non-verified, non-owner users */}
            {isOwner !== true && !isKYCApproved && (
              <button
                onClick={() => {
                  requestKYC();
                  setIsDropdownOpen(false);
                }}
                disabled={isPending}
                className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors"
                style={{ 
                  color: isPending ? "var(--text-muted)" : "var(--accent)",
                }}
                onMouseEnter={(e) => {
                  if (!isPending) {
                    e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 12 15 16 10" />
                </svg>
                <span className="text-sm font-medium">
                  {isPending ? "Processing..." : "Request KYC"}
                </span>
              </button>
            )}

            {/* Copy Address Option */}
            <button
              onClick={handleCopyAddress}
              className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors"
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {copied ? (
                <>
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="var(--green)" 
                    strokeWidth="2"
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-sm font-medium" style={{ color: "var(--green)" }}>
                    Copied!
                  </span>
                </>
              ) : (
                <>
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="var(--text-secondary)" 
                    strokeWidth="2"
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span className="text-sm font-medium">Copy Address</span>
                </>
              )}
            </button>

            {/* Admin Option - Only for owner */}
            {isOwner && (
              <Link
                href="/admin"
                onClick={() => setIsDropdownOpen(false)}
                className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors"
                style={{ color: "var(--text-primary)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="var(--text-secondary)" 
                  strokeWidth="2"
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l.06-.06a1.65 1.65 0 0 0 1.82-.33 1.65 1.65 0 0 0 0-2.83 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0-.33-1.82 1.65 1.65 0 0 0-2.83 0 1.65 1.65 0 0 0 0 2.83l-.06.06a1.65 1.65 0 0 0-.33-1.82 1.65 1.65 0 0 0-2.83 0 1.65 1.65 0 0 0 0 2.83l.06.06a1.65 1.65 0 0 0 .33 1.82l-.06.06a2 2 0 0 1 0 2.83" />
                </svg>
                <span className="text-sm font-medium">Admin Panel</span>
              </Link>
            )}

            {/* Divider */}
            <div 
              className="mx-2 border-t"
              style={{ borderColor: "var(--border-dim)" }}
            />

            {/* Disconnect Option */}
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors last:rounded-b-lg"
              style={{ color: "var(--red)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="text-sm font-medium">Disconnect</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Header() {
  const { isConnected } = useAccount();
  const { toggleTheme, isDark } = useThemeToggle();

  return (
    <header 
      className="sticky top-0 z-40 border-b border-[var(--border-default)]"
      style={{ 
        background: "var(--bg-surface)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex h-16 items-center justify-between px-4">
        {/* Left: Logo + Brand */}
        <div className="flex items-center gap-2 md:gap-4">
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
            
            {/* Brand Text */}
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
              <div className="hidden md:flex items-center gap-1">
                <span 
                  className="text-[7px] font-medium leading-tight"
                  style={{ 
                    color: "var(--text-muted)",
                  }}
                >
                  Trustless Trade
                </span>
                <span 
                  className="text-[7px] font-medium leading-tight"
                  style={{ 
                    color: "var(--text-muted)",
                  }}
                >
                  Infrastructure
                </span>
              </div>
            </div>
          </Link>

          {/* Navigation - Admin removed from here, now in dropdown */}
          <nav className="flex items-center gap-1">
            {[
              { href: "/", label: "Dashboard" },
              { href: "/disputes", label: "Disputes" },
              { href: "/receivables", label: "Receivables" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-2 md:px-3 py-2 text-xs md:text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
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

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Account Display - Show when connected */}
          <AccountDisplay />
          
          {/* Connect Button - Show only when NOT connected */}
          {!isConnected && (
            <div className="flex h-9 w-auto items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] transition-all hover:border-[var(--border-bright)] hover:bg-[var(--bg-elevated)]">
              <ConnectButton 
                accountStatus="address"
                chainStatus="none"
                showBalance={false}
              />
            </div>
          )}
          
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] transition-all hover:border-[var(--border-bright)] hover:bg-[var(--bg-elevated)]"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? (
              // Sun icon for light mode
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="var(--text-secondary)" 
                strokeWidth="2"
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              // Moon icon for dark mode
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="var(--text-secondary)" 
                strokeWidth="2"
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
