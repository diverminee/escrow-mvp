"use client";

import { useState, useRef, useEffect } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { config } from "@/lib/wagmi";
import { getDeployedChains, hasContracts } from "@/lib/contracts/addresses";

// Chain icon components - simplified icons for each network
function ChainIcon({ chainId, size = 20 }: { chainId: number; size?: number }) {
  const colors: Record<number, string> = {
    31337: "#F03E2F", // Foundry - red
    11155111: "#627EEA", // Sepolia - purple/blue
    84532: "#0052FF", // Base Sepolia - blue
    8453: "#0052FF", // Base - blue
    1: "#627EEA", // Ethereum - purple/blue
  };
  
  const color = colors[chainId] || "#627EEA";
  
  return (
    <div 
      style={{ 
        width: size, 
        height: size, 
        borderRadius: "50%", 
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg 
        width={size * 0.6} 
        height={size * 0.6} 
        viewBox="0 0 24 24" 
        fill="white"
      >
        <circle cx="12" cy="12" r="10" fill={color} />
        <circle cx="12" cy="12" r="4" fill="white" />
      </svg>
    </div>
  );
}

// Chain name mapping since we can't use the Chain type directly
const CHAIN_NAMES: Record<number, string> = {
  31337: "Foundry",
  11155111: "Sepolia",
  84532: "Base Sepolia",
  8453: "Base",
  1: "Ethereum",
};

// Get chain name by ID
function getChainName(chainId: number): string {
  return CHAIN_NAMES[chainId] || `Chain ${chainId}`;
}

export function NetworkSelector() {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Get deployed chains from addresses config
  const deployedChainIds = getDeployedChains();
  
  // Filter wagmi config chains to only show deployed ones
  const availableChains = config.chains.filter((chain: { id: number }) => 
    deployedChainIds.includes(chain.id)
  );
  
  // Current chain name
  const currentChainName = getChainName(chainId);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // If no chains are deployed, don't show selector
  if (availableChains.length === 0) {
    return null;
  }

  // If only 1 chain deployed, show as a static indicator
  if (availableChains.length === 1) {
    const chain = availableChains[0];
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg border"
        style={{ 
          borderColor: "var(--border-default)",
          backgroundColor: "var(--bg-surface)",
        }}
      >
        <ChainIcon chainId={chain.id} size={20} />
        <span 
          className="text-xs font-medium"
          style={{ 
            color: "var(--text-primary)",
          }}
        >
          {getChainName(chain.id)}
        </span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Pill-style button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all hover:bg-[var(--bg-elevated)]"
        style={{ 
          borderColor: isOpen ? "var(--accent)" : "var(--border-default)",
          backgroundColor: "var(--bg-surface)",
        }}
        disabled={isPending}
      >
        <ChainIcon chainId={chainId} size={18} />
        <span 
          className="text-xs font-medium"
          style={{ 
            color: "var(--text-primary)",
          }}
        >
          {currentChainName}
        </span>
        
        {/* Chevron */}
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="var(--text-muted)" 
          strokeWidth="2"
          strokeLinecap="round" 
          strokeLinejoin="round"
          style={{ 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-56 rounded-lg border shadow-lg z-50"
          style={{ 
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border-default)",
          }}
        >
          <div className="py-1">
            {availableChains.map((chain: { id: number }) => {
              const isActive = chain.id === chainId;
              const chainHasContracts = hasContracts(chain.id);
              
              return (
                <button
                  key={chain.id}
                  onClick={() => {
                    if (!isActive && chainHasContracts) {
                      switchChain({ chainId: chain.id });
                    }
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors"
                  style={{ 
                    color: isActive ? "var(--accent)" : "var(--text-primary)",
                    opacity: chainHasContracts ? 1 : 0.5,
                    cursor: chainHasContracts ? "pointer" : "not-allowed",
                    backgroundColor: "transparent",
                  }}
                  disabled={isActive || !chainHasContracts}
                >
                  <ChainIcon chainId={chain.id} size={20} />
                  
                  <div className="flex-1">
                    <span className="text-sm font-medium">{getChainName(chain.id)}</span>
                    {!chainHasContracts && (
                      <span 
                        className="text-xs ml-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        (No contracts)
                      </span>
                    )}
                  </div>
                  
                  {isActive && (
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="var(--accent)" 
                      strokeWidth="2"
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
