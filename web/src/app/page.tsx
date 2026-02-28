"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId } from "wagmi";
import { useEscrowCount } from "@/hooks/useEscrowRead";
import { useUserStats } from "@/hooks/useUserStats";
import { Header } from "@/components/layout/Header";
import { TierBadge } from "@/components/shared/TierBadge";
import { CreateEscrowForm } from "@/components/escrow/CreateEscrowForm";
import { EscrowList } from "@/components/escrow/EscrowList";
import { Skeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatFeeRate } from "@/lib/utils";

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: escrowCount } = useEscrowCount(chainId);
  const { stats, tier, feeRate, isLoading } = useUserStats(address, chainId);
  const [createFormOpen, setCreateFormOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div 
        className="min-h-screen"
        style={{ 
          background: "var(--bg-base)", 
          color: "var(--text-primary)",
          minHeight: "100vh"
        }}
      >
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
          <div className="mb-8 animate-in">
            <p 
              className="section-label mb-2"
              style={{ 
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.15em",
                textTransform: "uppercase"
              }}
            >
              Overview
            </p>
            <h1 
              className="page-heading"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "2rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                lineHeight: 1.2
              }}
            >
              Dashboard
            </h1>
          </div>
          <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
            <Skeleton width={200} height={24} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: "var(--bg-base)", 
        color: "var(--text-primary)",
        minHeight: "100vh"
      }}
    >
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">

        {/* Page Header */}
        <div className="mb-8 animate-in">
          <p 
            className="section-label mb-2"
            style={{ 
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.15em",
              textTransform: "uppercase"
            }}
          >
            Overview
          </p>
          <h1 
            className="page-heading"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "2rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.2
            }}
          >
            Dashboard
          </h1>
        </div>

        {!isConnected ? (
          <EmptyState
            icon="wallet"
            title="Connect Your Wallet"
            description="Connect your wallet to view your dashboard, create escrows, and manage your trade transactions on Credence."
          />
        ) : (
          <div 
            style={{ 
              display: "flex", 
              flexDirection: "column", 
              gap: "1.75rem" 
            }}
          >

            {/* Stats Grid */}
            <section
              className="animate-in animate-in-delay-1"
              style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", 
                gap: "1rem" 
              }}
            >
              {/* Tier Card */}
              <div className="stat-card">
                <div className="accent-line" style={{ height: "2px" }} />
                <p 
                  className="stat-label"
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "0.5rem"
                  }}
                >
                  Your Tier
                </p>
                <div style={{ marginTop: "0.5rem" }}>
                  {isLoading ? (
                    <Skeleton width={80} height="1.5rem" borderRadius="4px" />
                  ) : tier !== undefined ? (
                    <TierBadge tier={tier} />
                  ) : (
                    <span style={{ 
                      fontFamily: "'IBM Plex Mono', monospace", 
                      fontSize: "0.875rem", 
                      color: "var(--text-muted)" 
                    }}>
                      —
                    </span>
                  )}
                </div>
              </div>

              {/* Successful Trades Card */}
              <div className="stat-card">
                <div className="accent-line" style={{ height: "2px" }} />
                <p 
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "0.5rem"
                  }}
                >
                  Successful Trades
                </p>
                <div 
                  className="stat-value"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "2rem",
                    fontWeight: 700,
                    color: "var(--green)",
                    lineHeight: 1
                  }}
                >
                  {isLoading ? (
                    <Skeleton width={80} height="2rem" />
                  ) : stats ? (
                    <span style={{ color: Number(stats[0]) > 0 ? "var(--green)" : "var(--text-primary)" }}>
                      {String(stats[0])}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </div>
              </div>

              {/* Disputes Card */}
              <div className="stat-card">
                <div className="accent-line" style={{ height: "2px" }} />
                <p 
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "0.5rem"
                  }}
                >
                  Disputes Lost
                </p>
                <div 
                  className="stat-value"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "2rem",
                    fontWeight: 700,
                    lineHeight: 1
                  }}
                >
                  {isLoading ? (
                    <Skeleton width={80} height="2rem" />
                  ) : stats ? (
                    <span style={{ 
                      color: Number(stats[2]) > 0 ? "var(--red)" : "var(--text-primary)" 
                    }}>
                      {String(stats[2])}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </div>
              </div>

              {/* Fee Rate Card */}
              <div className="stat-card">
                <div className="accent-line" style={{ height: "2px" }} />
                <p 
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "0.5rem"
                  }}
                >
                  Fee Rate
                </p>
                <div 
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "2rem",
                    fontWeight: 700,
                    color: "var(--accent)",
                    lineHeight: 1
                  }}
                >
                  {isLoading ? (
                    <Skeleton width={80} height="2rem" />
                  ) : feeRate !== undefined ? (
                    formatFeeRate(feeRate)
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </div>
              </div>
            </section>

            {/* Escrows Section */}
            <section className="animate-in animate-in-delay-2">
              <div 
                className="card"
                style={{ 
                  padding: "1.5rem",
                  overflow: "hidden"
                }}
              >
                <div 
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between", 
                    marginBottom: "1.25rem",
                    paddingBottom: "1rem",
                    borderBottom: "1px solid var(--border-dim)"
                  }}
                >
                  <div>
                    <p 
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--highlight-soft)",
                        marginBottom: "0.25rem"
                      }}
                    >
                      Active
                    </p>
                    <h2 
                      style={{ 
                        fontFamily: "'Playfair Display', serif", 
                        fontWeight: 600, 
                        fontSize: "1.25rem", 
                        color: "var(--text-primary)" 
                      }}
                    >
                      Escrows
                    </h2>
                  </div>
                  <div 
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "1rem" 
                    }}
                  >
                    <span 
                      style={{ 
                        fontFamily: "'IBM Plex Mono', monospace", 
                        fontSize: "0.72rem", 
                        color: "var(--text-muted)", 
                        letterSpacing: "0.05em" 
                      }}
                    >
                      {escrowCount !== undefined ? `${String(escrowCount)} total` : ""}
                    </span>
                    <CreateEscrowForm onSuccess={() => setCreateFormOpen(false)} />
                  </div>
                </div>
                
                <EscrowList maxItems={5} />
              </div>
            </section>

          </div>
        )}
      </main>
    </div>
  );
}
