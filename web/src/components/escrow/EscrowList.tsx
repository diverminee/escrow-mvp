"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useChainId } from "wagmi";
import { useEscrowRead, useEscrowCount } from "@/hooks/useEscrowRead";
import { EscrowState } from "@/types/escrow";
import { StateChip } from "@/components/shared/StateChip";
import { AddressDisplay } from "@/components/shared/AddressDisplay";
import { TokenAmount } from "@/components/shared/TokenAmount";
import { Skeleton, SkeletonText } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { modeToLabel } from "@/lib/utils";

interface EscrowListItemProps {
  escrowId: bigint;
}

function EscrowListItem({ escrowId }: EscrowListItemProps) {
  const [mounted, setMounted] = useState(false);
  const chainId = useChainId();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <tr>
        <td><Skeleton width={60} height="1.25rem" /></td>
        <td><Skeleton width={80} height="1.5rem" /></td>
        <td><Skeleton width={100} height="1.25rem" /></td>
        <td><Skeleton width={120} height="1.25rem" /></td>
        <td><Skeleton width={140} height="1.25rem" /></td>
      </tr>
    );
  }
  const { escrow, isLoading, isError } = useEscrowRead(escrowId, chainId);

  if (isLoading) {
    return (
      <tr>
        <td><Skeleton width={60} height="1.25rem" /></td>
        <td><Skeleton width={80} height="1.5rem" /></td>
        <td><Skeleton width={100} height="1.25rem" /></td>
        <td><Skeleton width={120} height="1.25rem" /></td>
        <td><Skeleton width={140} height="1.25rem" /></td>
      </tr>
    );
  }

  if (isError || !escrow) {
    return (
      <tr>
        <td colSpan={5}>
          <span style={{ color: "var(--red)", fontSize: "0.875rem" }}>
            Failed to load escrow #{String(escrowId)}
          </span>
        </td>
      </tr>
    );
  }

  const state = Number(escrow.state);
  // Only show non-draft escrows
  if (state === EscrowState.DRAFT) {
    return null;
  }

  return (
    <tr>
      <td>
        <Link 
          href={`/escrow/${escrowId}`}
          style={{ 
            fontFamily: "'IBM Plex Mono', monospace", 
            fontSize: "0.875rem", 
            color: "var(--accent)",
            fontWeight: 500,
            textDecoration: "none"
          }}
          onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
          onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
        >
          #{String(escrowId)}
        </Link>
      </td>
      <td>
        <StateChip state={state} />
      </td>
      <td>
        <span style={{ 
          fontFamily: "'Source Sans 3', sans-serif", 
          fontSize: "0.75rem", 
          fontWeight: 500,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em"
        }}>
          {modeToLabel(Number(escrow.mode))}
        </span>
      </td>
      <td>
        <TokenAmount amount={escrow.amount} token={escrow.token} />
      </td>
      <td>
        <AddressDisplay address={escrow.seller} />
      </td>
    </tr>
  );
}

interface EscrowListProps {
  maxItems?: number;
}

export function EscrowList({ maxItems = 10 }: EscrowListProps) {
  const [mounted, setMounted] = useState(false);
  const chainId = useChainId();
  const { data: escrowCount, isLoading: isCountLoading } = useEscrowCount(chainId);
  const count = escrowCount ? Number(escrowCount) : 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border-default)", background: "var(--bg-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Skeleton width={120} height="1rem" />
            <Skeleton width={60} height="0.875rem" />
          </div>
        </div>
        <div style={{ padding: "1.5rem" }}>
          <SkeletonTable rows={5} />
        </div>
      </div>
    );
  }

  if (isCountLoading) {
    return (
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border-default)", background: "var(--bg-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Skeleton width={120} height="1rem" />
            <Skeleton width={60} height="0.875rem" />
          </div>
        </div>
        <div style={{ padding: "1.5rem" }}>
          <SkeletonTable rows={5} />
        </div>
      </div>
    );
  }

  if (count === 0) {
    return (
      <EmptyState
        icon="escrow"
        title="No Escrows Yet"
        description="Create your first escrow to start trading securely. Funds are locked until delivery is confirmed by the buyer or oracle."
      />
    );
  }

  // Generate array of escrow IDs (most recent first)
  const escrowIds: bigint[] = [];
  const start = Math.max(0, count - maxItems);
  for (let i = count - 1; i >= start; i--) {
    escrowIds.push(BigInt(i));
  }

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Table Header */}
      <div 
        style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          padding: "0.875rem 1.25rem", 
          borderBottom: "1px solid var(--border-default)", 
          background: "var(--bg-subtle)" 
        }}
      >
        <span style={{ 
          fontFamily: "'Source Sans 3', sans-serif", 
          fontSize: "0.8rem", 
          fontWeight: 600, 
          color: "var(--text-secondary)",
          letterSpacing: "0.03em"
        }}>
          Recent Escrows
        </span>
        <span style={{ 
          fontFamily: "'IBM Plex Mono', monospace", 
          fontSize: "0.7rem", 
          color: "var(--text-muted)", 
          letterSpacing: "0.05em" 
        }}>
          {count} total
        </span>
      </div>
      
      {/* Table */}
      <div className="table-container" style={{ border: "none" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: "80px" }}>ID</th>
              <th style={{ width: "120px" }}>Status</th>
              <th style={{ width: "140px" }}>Mode</th>
              <th style={{ width: "180px" }}>Amount</th>
              <th>Seller</th>
            </tr>
          </thead>
          <tbody>
            {escrowIds.map((id) => (
              <EscrowListItem key={id.toString()} escrowId={id} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Also export the skeleton table for reuse
function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="table-container" style={{ border: "none" }}>
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: "80px" }}><Skeleton width={40} /></th>
            <th style={{ width: "120px" }}><Skeleton width={60} /></th>
            <th style={{ width: "140px" }}><Skeleton width={80} /></th>
            <th style={{ width: "180px" }}><Skeleton width={100} /></th>
            <th><Skeleton width={140} /></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td><Skeleton width={50} height="1.25rem" /></td>
              <td><Skeleton width={70} height="1.5rem" borderRadius="9999" /></td>
              <td><Skeleton width={90} height="1rem" /></td>
              <td><Skeleton width={120} height="1rem" /></td>
              <td><Skeleton width={150} height="1rem" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
