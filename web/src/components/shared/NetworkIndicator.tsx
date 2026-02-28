"use client";

import { useState, useEffect } from "react";
import { useChainId } from "wagmi";

interface NetworkIndicatorProps {
  className?: string;
}

export function NetworkIndicator({ className = "" }: NetworkIndicatorProps) {
  const chainId = useChainId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div 
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${className}`}
        style={{ 
          borderColor: "var(--border-default)",
          backgroundColor: "var(--bg-subtle)",
        }}
      >
        <div 
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: "var(--text-muted)" }}
        />
        <span 
          className="text-xs font-medium"
          style={{ 
            fontFamily: "'IBM Plex Mono', monospace",
            color: "var(--text-muted)" 
          }}
        >
          Connecting...
        </span>
      </div>
    );
  }
  
  const networkNames: Record<number, string> = {
    31337: "Local",
    11155111: "Sepolia",
    84532: "Base Sepolia",
    8453: "Base",
    1: "Ethereum",
  };

  const networkColors: Record<number, string> = {
    31337: "#3B82F6", // Blue for local
    11155111: "#8B5CF6", // Purple for Sepolia
    84532: "#06B6D4", // Cyan for Base Sepolia
    8453: "#06B6D4", // Cyan for Base Mainnet
    1: "#10B981", // Green for Mainnet
  };

  const networkName = networkNames[chainId] || `Chain ${chainId}`;
  const color = networkColors[chainId] || "var(--accent)";

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${className}`}
      style={{ 
        borderColor: "var(--border-default)",
        backgroundColor: "var(--bg-subtle)",
      }}
    >
      {/* Network indicator dot */}
      <div 
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
      />
      
      {/* Network name */}
      <span 
        className="text-xs font-medium whitespace-nowrap"
        style={{ 
          fontFamily: "'IBM Plex Mono', monospace",
          color: "var(--text-primary)",
          letterSpacing: "0.02em"
        }}
      >
        {networkName}
      </span>
      
      {/* Chain ID */}
      <span 
        className="text-xs opacity-60"
        style={{ 
          fontFamily: "'IBM Plex Mono', monospace",
          color: "var(--text-muted)" 
        }}
      >
        #{chainId}
      </span>
    </div>
  );
}
