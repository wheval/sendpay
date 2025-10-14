import type { Metadata } from "next"
import { Manrope } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

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
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
