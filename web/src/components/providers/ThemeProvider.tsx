"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: "class" | "data-theme";
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

export function ThemeProvider({ 
  children, 
  attribute = "class",
  defaultTheme = "dark",
  enableSystem = true,
  disableTransitionOnChange = true
}: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent flash of wrong theme - don't render until mounted
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <div 
      style={{ minHeight: "100vh" }}
    >
      {children}
    </div>
  );
}

// Hook to use theme in components
export function useThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  
  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return {
    theme: resolvedTheme || theme,
    toggleTheme,
    isDark: resolvedTheme === "dark" || theme === "dark"
  };
}
