"use client";

import { AuthProvider } from "@/lib/auth";
import { CurrencyProvider } from "@/components/currency-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CurrencyProvider>
          {children}
          <Toaster richColors position="top-right" />
        </CurrencyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
