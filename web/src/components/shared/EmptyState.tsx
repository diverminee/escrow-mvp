import Link from "next/link";

interface EmptyStateProps {
  icon?: "escrow" | "dispute" | "receivable" | "search" | "wallet" | "info";
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

const icons = {
  escrow: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  ),
  dispute: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  ),
  receivable: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h10" />
      <path d="M7 12h6" />
      <path d="M7 16h4" />
    </svg>
  ),
  search: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  wallet: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </svg>
  ),
  info: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  ),
};

export function EmptyState({ icon = "info", title, description, action }: EmptyStateProps) {
  const content = (
    <div className="empty-state">
      <div 
        className="empty-state-icon"
        style={{ color: "var(--text-muted)" }}
      >
        {icons[icon]}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="btn-primary"
            onClick={action.onClick}
          >
            {action.label}
          </Link>
        ) : (
          <button
            className="btn-primary"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );

  return (
    <div className="card animate-in" style={{ padding: "2rem" }}>
      {content}
    </div>
  );
}

// Specialized empty states for common scenarios
export function NoEscrowsEmptyState({ onCreateNew }: { onCreateNew?: () => void }) {
  return (
    <EmptyState
      icon="escrow"
      title="No Escrows Yet"
      description="Create your first escrow to start a secure trade transaction. Funds are locked until delivery is confirmed."
      action={{
        label: "Create Escrow",
        onClick: onCreateNew,
      }}
    />
  );
}

export function NoDisputesEmptyState() {
  return (
    <EmptyState
      icon="dispute"
      title="No Disputes"
      description="Great! There are no active disputes. All trades are proceeding smoothly."
    />
  );
}

export function NoReceivablesEmptyState() {
  return (
    <EmptyState
      icon="receivable"
      title="No Trade Receivables"
      description="Trade receivables will appear here when sellers commit documents to payment commitment escrows."
    />
  );
}

export function NotConnectedEmptyState() {
  return (
    <EmptyState
      icon="wallet"
      title="Connect Your Wallet"
      description="Connect your wallet to view your dashboard, create escrows, and manage your trade transactions."
    />
  );
}

export function NotKYCEmptyState() {
  return (
    <EmptyState
      icon="info"
      title="KYC Approval Required"
      description="Your wallet address needs to be KYC-approved to create escrows. Please contact the protocol administrator."
    />
  );
}

export function SearchEmptyState({ query }: { query: string }) {
  return (
    <EmptyState
      icon="search"
      title="No Results Found"
      description={`We couldn't find any items matching "${query}". Try adjusting your search or filters.`}
    />
  );
}
