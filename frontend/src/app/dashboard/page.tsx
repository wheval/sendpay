"use client"

import { useEffect, useState } from "react"
import Navigation from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useRouter } from "next/navigation"
import { Wallet, DollarSign, TrendingUp, History } from "lucide-react"
import { cookies } from "@/lib/cookies"

interface UserData {
  id: string
  email: string
  name: string
  cavosWalletAddress: string
  balanceUSD: number
  balanceNGN: number
}

export default function DashboardPage() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const token = cookies.get('jwt')
      if (!token) {
        router.push('/login')
        return
      }

      try {
        // Always fetch fresh profile first
        const userRes = await api.user.profile(token)
        const freshUser = userRes.user || userRes.data || null
        if (freshUser) {
          // If DB is missing wallet but cookie has it, sync once per session
          const cookieWallet = cookies.get('walletAddress')
          const syncKey = 'walletSyncDone'
          const didSync = typeof window !== 'undefined' ? sessionStorage.getItem(syncKey) : '1'
          if (!freshUser.cavosWalletAddress && cookieWallet && !didSync) {
            try {
              await api.user.walletSync(cookieWallet, token)
              sessionStorage.setItem(syncKey, '1')
              const refetched = await api.user.profile(token)
              const refUser = refetched.user || refetched.data || freshUser
              setUserData(refUser)
              localStorage.setItem('user', JSON.stringify(refUser))
            } catch {
              setUserData(freshUser)
              localStorage.setItem('user', JSON.stringify(freshUser))
            }
          } else {
            setUserData(freshUser)
            localStorage.setItem('user', JSON.stringify(freshUser))
          }

          const activeWallet = (cookieWallet && !freshUser.cavosWalletAddress) ? cookieWallet : freshUser.cavosWalletAddress
          if (activeWallet) {
            const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf56a5fc'
            try {
              const balanceRes = await api.cavos.balance(activeWallet, usdcAddress, '6', token)
              setBalance(balanceRes.data?.formatted || balanceRes.data?.balance || '0')
            } catch {
              setBalance('0')
            }
          }
          setLoading(false)
          return
        }
        // If response shape unexpected, fall through to cached user
        throw new Error('Invalid profile response')
      } catch {
        // Fallback to cached user (cookie or localStorage)
        const cookieUser = cookies.get('user')
        const userStr = cookieUser || localStorage.getItem('user')
        if (userStr) {
          try {
            const cachedUser = JSON.parse(userStr)
            setUserData(cachedUser)
          } catch {
            // ignore parse errors
          }
        }
        if (!userStr) {
          setError('Failed to load user data')
        }
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  const handleLogout = () => {
    localStorage.clear()
    // Remove all auth-related cookies
    cookies.removeMultiple(['jwt', 'accessToken', 'refreshToken', 'walletAddress', 'user'])
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-2xl">
          <div className="mb-6">
            <div className="h-8 w-40 bg-muted rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-6 w-6 bg-muted rounded-full animate-pulse" />
                </div>
                <div className="h-7 w-24 bg-muted rounded mb-2 animate-pulse" />
                <div className="h-3 w-32 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border rounded-lg p-6">
              <div className="h-5 w-32 bg-muted rounded mb-4 animate-pulse" />
              <div className="space-y-3">
                <div className="h-10 w-full bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted rounded animate-pulse" />
              </div>
            </div>
            <div className="border rounded-lg p-6">
              <div className="h-5 w-40 bg-muted rounded mb-4 animate-pulse" />
              <div className="space-y-3">
                <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                <div className="h-4 w-56 bg-muted rounded animate-pulse" />
                <div className="h-4 w-64 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No user data found</p>
          <Button onClick={() => router.push('/login')} className="mt-4">
            Go to Login
          </Button>
        </div>
      </div>
    )
  }

  const displayWallet = userData.cavosWalletAddress || cookies.get('walletAddress') || ''

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Balance (USD)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${userData.balanceUSD?.toFixed(2) || '0.00'}</div>
              <p className="text-xs text-muted-foreground">
                ≈ ₦{(userData.balanceNGN || 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">USDC Balance</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{balance || '0'} USDC</div>
              <p className="text-xs text-muted-foreground">Starknet balance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wallet Address</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-mono">
                {displayWallet ? 
                  `${displayWallet.slice(0, 6)}...${displayWallet.slice(-4)}` :
                  'Not set'
                }
              </div>
              <p className="text-xs text-muted-foreground">Cavos wallet</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Account Status</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Active</div>
              <p className="text-xs text-muted-foreground">Ready for transactions</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" onClick={() => router.push('/receive')}>
                Receive Payment
              </Button>
              <Button className="w-full" variant="outline" onClick={() => router.push('/withdraw')}>
                Withdraw Funds
              </Button>
              <Button className="w-full" variant="outline" onClick={() => router.push('/history')}>
                View History
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <p className="text-sm text-muted-foreground">{userData.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <p className="text-sm text-muted-foreground">{userData.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Wallet Address</label>
                <p className="text-sm font-mono text-muted-foreground break-all">
                  {displayWallet || 'Not configured'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}