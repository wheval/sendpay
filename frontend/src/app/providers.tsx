"use client"

import { ThemeProvider } from "@/components/theme-provider"
import { ChipiProvider } from "@/components/providers/ChipiProvider"
import { Toaster } from "@/components/ui/toaster"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ChipiProvider>
        {/* <StarknetConfig chains={[mainnet]} provider={publicProvider()}> */}
          {children}
          <Toaster />
        {/* </StarknetConfig> */}
      </ChipiProvider>
    </ThemeProvider>
  )
}


