"use client"

import { useEffect, useState } from "react"
import Navigation from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useRouter } from "next/navigation"
import { Wallet, DollarSign, TrendingUp, History } from "lucide-react"

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
      const token = localStorage.getItem('jwt')
      const userStr = localStorage.getItem('user')
      
      if (!token) {
        router.push('/login')
        return
      }

      if (userStr) {
        try {
          const user = JSON.parse(userStr)
          setUserData(user)
          
          // Get balance from backend
          if (user.cavosWalletAddress) {
            const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf56a5fc'
            try {
              const balanceRes = await api.cavos.balance(user.cavosWalletAddress, usdcAddress, '6', token)
              setBalance(balanceRes.data?.formatted || balanceRes.data?.balance || '0')
            } catch (err: any) {
              console.error('Balance fetch failed:', err)
              setBalance('0')
            }
          }
        } catch (err: any) {
          console.error('User data parse failed:', err)
          setError('Failed to load user data')
        }
      } else {
        // Try to get user data from backend
        try {
          const userRes = await api.user.profile(token)
          setUserData(userRes.data)
        } catch (err: any) {
          console.error('Profile fetch failed:', err)
          setError('Failed to load profile')
        }
      }
      
      setLoading(false)
    }

    checkAuth()
  }, [router])

  const handleLogout = () => {
    localStorage.clear()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
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
                {userData.cavosWalletAddress ? 
                  `${userData.cavosWalletAddress.slice(0, 6)}...${userData.cavosWalletAddress.slice(-4)}` : 
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
                  {userData.cavosWalletAddress || 'Not configured'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
