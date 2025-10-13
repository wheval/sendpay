import type { Metadata } from "next"
import { Manrope } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ChipiProvider } from "@/components/providers/ChipiProvider"
import { Toaster } from "@/components/ui/toaster"

const manrope = Manrope({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SendPay - Crypto in. Cash out Instantly For Africa",
  description: "Fast, secure, and reliable money transfers at your fingertips.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={manrope.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ChipiProvider>
            {children}
            <Toaster />
          </ChipiProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
