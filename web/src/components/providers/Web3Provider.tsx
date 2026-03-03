'use client';

import { WagmiProvider, useDisconnect } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { config } from '@/lib/wagmi';

const queryClient = new QueryClient();

// Custom theme matching Credence design system
const credenceTheme = darkTheme({
  accentColor: "#A65E46",
  accentColorForeground: "white",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
});

// Session timeout: 15 minutes of inactivity
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

function SessionManager() {
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  useSessionTimeout({
    timeoutMs: SESSION_TIMEOUT_MS,
    onTimeout: () => {
      disconnect();
    },
    enabled: isConnected,
  });

  return null;
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={credenceTheme}>
          <SessionManager />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

