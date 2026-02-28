"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useChainId, useAccount } from "wagmi";
import { useEscrowRead } from "@/hooks/useEscrowRead";
import { Header } from "@/components/layout/Header";
import { StateChip } from "@/components/shared/StateChip";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { TokenAmount } from "@/components/shared/TokenAmount";
import { EscrowActions } from "@/components/escrow/EscrowActions";
import { Skeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { modeToLabel, formatTimestamp } from "@/lib/utils";
import Link from "next/link";

export default function EscrowDetailPage() {
  const [mounted, setMounted] = useState(false);
  const params = useParams();
  const escrowId = BigInt(params.id as string);
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { escrow, documents, isLoading, isError } = useEscrowRead(escrowId, chainId);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        <main className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">
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
              Escrow Detail
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
              Escrow <span style={{ color: "var(--accent)" }}>#{params.id}</span>
            </h1>
          </div>
          <div className="card animate-in" style={{ padding: "3rem" }}>
            <div className="space-y-4">
              <Skeleton width="100%" height="3rem" />
              <Skeleton width="100%" height="1.5rem" />
              <Skeleton width="80%" height="1.5rem" />
            </div>
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
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">

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
            Escrow Detail
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
            Escrow <span style={{ color: "var(--accent)" }}>#{String(escrowId)}</span>
          </h1>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="card animate-in" style={{ padding: "3rem" }}>
            <div className="space-y-4">
              <Skeleton width="100%" height="3rem" />
              <Skeleton width="100%" height="1.5rem" />
              <Skeleton width="80%" height="1.5rem" />
            </div>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <EmptyState
            icon="info"
            title="Failed to Load Escrow"
            description="There was an error loading this escrow. Please check the escrow ID and try again."
            action={{
              label: "Back to Dashboard",
              href: "/",
            }}
          />
        )}

        {/* Escrow Data */}
        {escrow && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* Status Bar */}
            <div
              className="animate-in animate-in-delay-1"
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "1rem", 
                padding: "1rem 1.5rem", 
                background: "var(--bg-elevated)", 
                border: "1px solid var(--border-default)", 
                borderLeft: "3px solid var(--highlight)", 
                borderRadius: "4px" 
              }}
            >
              <StateChip state={Number(escrow.state)} />
              <div style={{ width: "1px", height: "20px", background: "var(--border-bright)" }} />
              <span style={{ 
                fontFamily: "'Source Sans 3', sans-serif", 
                fontSize: "0.75rem", 
                fontWeight: 600, 
                color: "var(--text-muted)", 
                letterSpacing: "0.1em", 
                textTransform: "uppercase" 
              }}>
                {modeToLabel(Number(escrow.mode))}
              </span>
              <div style={{ width: "1px", height: "20px", background: "var(--border-bright)" }} />
              <span style={{ 
                fontFamily: "'IBM Plex Mono', monospace", 
                fontSize: "0.75rem", 
                color: "var(--text-secondary)" 
              }}>
                ID: #{String(escrowId)}
              </span>
            </div>

            {/* Parties Card */}
            <section className="card animate-in animate-in-delay-2" style={{ padding: "1.5rem" }}>
              <div className="accent-line" />
              <p 
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "var(--highlight-soft)",
                  marginBottom: "1.25rem"
                }}
              >
                Parties
              </p>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", 
                gap: "1.5rem" 
              }}>
                {[
                  { label: "Buyer", addr: escrow.buyer },
                  { label: "Seller", addr: escrow.seller },
                  { label: "Arbiter", addr: escrow.arbiter },
                ].map(({ label, addr }) => (
                  <div key={label}>
                    <p style={{ 
                      fontFamily: "'Source Sans 3', sans-serif", 
                      fontSize: "0.65rem", 
                      fontWeight: 600, 
                      letterSpacing: "0.14em", 
                      textTransform: "uppercase", 
                      color: "var(--text-muted)", 
                      marginBottom: "0.5rem" 
                    }}>
                      {label}
                    </p>
                    <AddressDisplay address={addr} />
                  </div>
                ))}
              </div>
            </section>

            {/* Financials Card */}
            <section className="card animate-in animate-in-delay-3" style={{ padding: "1.5rem" }}>
              <div className="accent-line" />
              <p 
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "var(--highlight-soft)",
                  marginBottom: "1.25rem"
                }}
              >
                Financials
              </p>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", 
                gap: "1.5rem" 
              }}>
                <div>
                  <p style={{ 
                    fontFamily: "'Source Sans 3', sans-serif", 
                    fontSize: "0.65rem", 
                    fontWeight: 600, 
                    letterSpacing: "0.14em", 
                    textTransform: "uppercase", 
                    color: "var(--text-muted)", 
                    marginBottom: "0.5rem" 
                  }}>
                    Amount
                  </p>
                  <TokenAmount amount={escrow.amount} token={escrow.token} />
                </div>
                <div>
                  <p style={{ 
                    fontFamily: "'Source Sans 3', sans-serif", 
                    fontSize: "0.65rem", 
                    fontWeight: 600, 
                    letterSpacing: "0.14em", 
                    textTransform: "uppercase", 
                    color: "var(--text-muted)", 
                    marginBottom: "0.5rem" 
                  }}>
                    Collateral
                  </p>
                  <TokenAmount amount={escrow.collateralAmount} token={escrow.token} />
                </div>
                <div>
                  <p style={{ 
                    fontFamily: "'Source Sans 3', sans-serif", 
                    fontSize: "0.65rem", 
                    fontWeight: 600, 
                    letterSpacing: "0.14em", 
                    textTransform: "uppercase", 
                    color: "var(--text-muted)", 
                    marginBottom: "0.5rem" 
                  }}>
                    Fee Rate
                  </p>
                  <span style={{ 
                    fontFamily: "'Playfair Display', serif", 
                    fontSize: "1.25rem", 
                    fontWeight: 600, 
                    color: "var(--accent)" 
                  }}>
                    {(Number(escrow.feeRate) / 10).toFixed(1)}%
                  </span>
                </div>
                {escrow.maturityDate > 0n && (
                  <div>
                    <p style={{ 
                      fontFamily: "'Source Sans 3', sans-serif", 
                      fontSize: "0.65rem", 
                      fontWeight: 600, 
                      letterSpacing: "0.14em", 
                      textTransform: "uppercase", 
                      color: "var(--text-muted)", 
                      marginBottom: "0.5rem" 
                    }}>
                      Maturity
                    </p>
                    <span style={{ 
                      fontFamily: "'IBM Plex Mono', monospace", 
                      fontSize: "0.875rem", 
                      color: "var(--text-secondary)" 
                    }}>
                      {formatTimestamp(escrow.maturityDate)}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Documents Card */}
            {documents && documents.committedAt > 0n && (
              <section className="card animate-in animate-in-delay-4" style={{ padding: "1.5rem" }}>
                <div className="accent-line" />
                <p 
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "var(--highlight-soft)",
                    marginBottom: "1.25rem"
                  }}
                >
                  Documents
                </p>
                <div style={{ 
                  background: "var(--bg-base)", 
                  border: "1px solid var(--border-dim)", 
                  borderLeft: "2px solid var(--highlight)", 
                  borderRadius: "4px", 
                  padding: "1rem" 
                }}>
                  <p style={{ 
                    fontFamily: "'Source Sans 3', sans-serif", 
                    fontSize: "0.65rem", 
                    fontWeight: 600, 
                    letterSpacing: "0.14em", 
                    textTransform: "uppercase", 
                    color: "var(--text-muted)", 
                    marginBottom: "0.5rem" 
                  }}>
                    Merkle Root
                  </p>
                  <p style={{ 
                    fontFamily: "'IBM Plex Mono', monospace", 
                    fontSize: "0.75rem", 
                    color: "var(--text-secondary)", 
                    wordBreak: "break-all" 
                  }}>
                    {documents.merkleRoot}
                  </p>
                </div>
                <p style={{ 
                  fontFamily: "'IBM Plex Mono', monospace", 
                  fontSize: "0.7rem", 
                  color: "var(--text-muted)", 
                  marginTop: "0.75rem", 
                  letterSpacing: "0.04em" 
                }}>
                  Committed {formatTimestamp(documents.committedAt)}
                </p>
              </section>
            )}

            {/* Actions */}
            {isConnected && (
              <div className="animate-in animate-in-delay-4">
                <EscrowActions escrowId={escrowId} escrow={escrow} />
              </div>
            )}

            {/* Back Link */}
            <Link
              href="/"
              style={{ 
                display: "block", 
                textAlign: "center", 
                fontFamily: "'Source Sans 3', sans-serif", 
                fontSize: "0.8rem", 
                fontWeight: 500, 
                letterSpacing: "0.1em", 
                textTransform: "uppercase", 
                color: "var(--text-muted)", 
                textDecoration: "none", 
                padding: "1rem",
                borderRadius: "4px",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--accent)";
                e.currentTarget.style.background = "var(--bg-subtle)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              ← Back to Dashboard
            </Link>

          </div>
        )}
      </main>
    </div>
  );
}
