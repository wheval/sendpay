"use client"

import { useEffect, useState } from "react"
import Navigation from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useRouter } from "next/navigation"
import { Wallet, DollarSign, TrendingUp, History } from "lucide-react"
import { cookies } from "@/lib/cookies"
import { getTokenConfig, type TokenSymbol } from "@/lib/constants"
import { normalizeHex } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface UserData {
  id: string
  email: string
  name: string
  cavosWalletAddress?: string
  balanceUSD: number
  balanceNGN: number
}

export default function DashboardPage() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [balance, setBalance] = useState<string | null>(null) // USDT
  const [strkBalance, setStrkBalance] = useState<string | null>(null)
  const [fxRate, setFxRate] = useState<number | null>(null) // USD->NGN
  const [strkUsd, setStrkUsd] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false) // For balances and rates
  const [error, setError] = useState("")
  const [showNGN, setShowNGN] = useState(true) // Default to NGN view
  const [showFundModal, setShowFundModal] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const token = cookies.get('jwt')
      if (!token) {
        router.push('/login')
        return
      }

      try {
        // Set loading to false immediately after getting user data
        const userRes = await api.user.profile(token)
        const freshUser = userRes.user || userRes.data || null
        
        if (freshUser) {
          // Set user data immediately to show dashboard faster
          setUserData(freshUser)
          localStorage.setItem('user', JSON.stringify(freshUser))
          
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
            } catch (syncError) {
              // Keep the original user data if sync fails
            }
          }

          // Set loading to false here so dashboard shows immediately
          setLoading(false)

          // Fetch balances and rates in parallel (non-blocking)
          const activeWallet = (cookieWallet && !freshUser.cavosWalletAddress) ? cookieWallet : freshUser.cavosWalletAddress
          
          if (activeWallet) {
            // Set data loading state
            setDataLoading(true)
            
            // Fetch all data in parallel for better performance
            Promise.allSettled([
              // USDC balance
              (async () => {
                try {
                  const usdc = getTokenConfig('USDC')
                  const balanceRes = await api.cavos.balance(activeWallet, usdc.address, usdc.decimals, token)
                  const normalize = (res: any, decimals: string) => {
                    const d = Number(decimals || '18')
                    const formatted = res?.data?.formatted
                    const raw = res?.data?.balance ?? res?.data
                    if (formatted && !isNaN(Number(formatted))) return String(formatted)
                    const rawNum = Number(raw || 0)
                    if (!isNaN(rawNum) && d >= 0) {
                      const val = rawNum / Math.pow(10, d)
                      return val.toString()
                    }
                    return '0'
                  }
                  const normalizedBalance = normalize(balanceRes, usdc.decimals)
                  setBalance(normalizedBalance)
                } catch (error) {
                  // Keep as null instead of setting to "0" to prevent snapping
                  setBalance(null)
                }
              })(),
              
              // STRK balance
              (async () => {
                try {
                  const strk = getTokenConfig('STRK')
                  const strkRes = await api.cavos.balance(activeWallet, strk.address, strk.decimals, token)
                  const normalize = (res: any, decimals: string) => {
                    const d = Number(decimals || '18')
                    const formatted = res?.data?.formatted
                    const raw = res?.data?.balance ?? res?.data
                    if (formatted && !isNaN(Number(formatted))) return String(formatted)
                    const rawNum = Number(raw || 0)
                    if (!isNaN(rawNum) && d >= 0) {
                      const val = rawNum / Math.pow(10, d)
                      return val.toString()
                    }
                    return '0'
                  }
                  const normalizedStrkBalance = normalize(strkRes, strk.decimals)
                  setStrkBalance(normalizedStrkBalance)
                } catch (error) {
                  // Keep as null instead of setting to "0" to prevent snapping
                  setStrkBalance(null)
                }
              })(),
              
              // FX rate and prices
              (async () => {
                try {
                  const summaryRes = await api.transaction.summary(token)
                  const rate = summaryRes.data?.exchangeRate || summaryRes.exchangeRate || 0
                  const strkPrice = summaryRes.data?.prices?.STRK_USD || summaryRes.prices?.STRK_USD || 0
                  setFxRate(Number(rate) || 0)
                  setStrkUsd(Number(strkPrice) || 0)
                } catch (error) {
                  // Keep as null instead of setting to 0 to prevent snapping
                  setFxRate(null)
                  setStrkUsd(null)
                }
              })()
            ]).then(() => {
              setDataLoading(false)
            })
          }
          
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
      <div className="min-h-screen bg-background">
        <Navigation landing={false} />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
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

  const displayWallet = normalizeHex(userData.cavosWalletAddress || cookies.get('walletAddress') || '')
  
  // Check if wallet address is actually valid
  const hasValidWallet = displayWallet && displayWallet.length >= 42 && displayWallet.startsWith('0x')
  
  const finalDisplayWallet = hasValidWallet ? displayWallet : "Wallet Address unavailable"

  return (
    <div className="min-h-screen bg-background">
      <Navigation landing={false} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            {!dataLoading && (!balance || !strkBalance) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Some data failed to load</span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="h-6 px-2 text-xs"
                >
                  Retry
                </Button>
              </div>
            )}
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Currency:</span>
              <Button 
                variant={showNGN ? "default" : "outline"} 
                size="sm"
                onClick={() => setShowNGN(true)}
              >
                NGN
              </Button>
              <Button 
                variant={!showNGN ? "default" : "outline"} 
                size="sm"
                onClick={() => setShowNGN(false)}
              >
                USD
              </Button>
            </div>
            {fxRate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rate: 1$ = ₦{fxRate.toLocaleString()}</span>
              </div>
            )}
            <Button variant="outline" onClick={handleLogout} className="hidden md:inline-flex">
              Logout
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Balance ({showNGN ? 'NGN' : 'USD'})
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <div className="space-y-2">
                  <div className="h-8 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                </div>
              ) : (
                (() => {
                  // Only show real values if we have actual data, not just default 0s
                  if (balance === null && strkBalance === null && fxRate === null && strkUsd === null) {
                    return (
                      <div className="space-y-2">
                        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
                        <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                      </div>
                    )
                  }
                  
                  const usdtNum = Number(balance || '0')
                  const strkNum = Number(strkBalance || '0')
                  const totalUsd = usdtNum + (strkNum * (strkUsd || 0))
                  const totalNgn = totalUsd * (fxRate || 0)
                  return (
                    <div className="transition-all duration-500 ease-out opacity-100">
                      <div className="text-3xl font-bold">
                        {showNGN ? `₦${totalNgn.toLocaleString()}` : `$${totalUsd.toFixed(2)}`}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        ≈ {showNGN ? `$${totalUsd.toFixed(2)} USD` : `₦${totalNgn.toLocaleString()} NGN`}
                      </p>
                    </div>
                  )
                })()
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">USDC Balance</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <div className="space-y-2">
                  <div className="h-6 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                </div>
              ) : (
                (() => {
                  // Only show real values if we have actual data, not just default 0s
                  if (balance === null && fxRate === null) {
                    return (
                      <div className="space-y-2">
                        <div className="h-6 w-24 bg-muted rounded animate-pulse" />
                        <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                      </div>
                    )
                  }
                  
                  const usdcNum = Number(balance || '0')
                  const usdcUsd = usdcNum // 1 USDC = 1 USD
                  const usdcNgn = usdcUsd * (fxRate || 0)
                  return (
                    <div className="transition-all duration-500 ease-out opacity-100">
                      <div className="text-2xl font-bold">
                        {showNGN ? `₦${usdcNgn.toLocaleString()}` : `${usdcNum} USDC`}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {showNGN ? `≈ ${usdcNum} USDC ($${usdcUsd.toFixed(2)})` : `≈ ₦${usdcNgn.toLocaleString()} NGN`}
                      </p>
                    </div>
                  )
                })()
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">STRK Balance</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <div className="space-y-2">
                  <div className="h-6 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                </div>
              ) : (
                (() => {
                  // Only show real values if we have actual data, not just default 0s
                  if (strkBalance === null && strkUsd === null && fxRate === null) {
                    return (
                      <div className="space-y-2">
                        <div className="h-6 w-24 bg-muted rounded animate-pulse" />
                        <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                      </div>
                    )
                  }
                  
                  const strkNum = Number(strkBalance || '0')
                  const strkUsdValue = strkNum * (strkUsd || 0)
                  const strkNgn = strkUsdValue * (fxRate || 0)
                  return (
                    <div className="transition-all duration-500 ease-out opacity-100">
                      <div className="text-2xl font-bold">
                        {showNGN ? `₦${strkNgn.toLocaleString()}` : `${strkNum} STRK`}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {showNGN ? `≈ ${strkNum} STRK ($${strkUsdValue.toFixed(2)})` : `≈ ₦${strkNgn.toLocaleString()} NGN`}
                      </p>
                    </div>
                  )
                })()
              )}
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
              <Button 
                className="w-full" 
                onClick={() => {
                  if (hasValidWallet) {
                    setShowFundModal(true)
                  } else {
                    // Show a message that the wallet is not configured
                    alert('Please contact support to configure your Starknet wallet address before using the fund account feature.')
                  }
                }}
                disabled={!hasValidWallet}
              >
                {hasValidWallet ? 'Fund Account' : 'Fund Account (Not Configured)'}
              </Button>
              <Button className="w-full" variant="outline" onClick={() => router.push('/withdraw')}>
                Withdraw Funds
              </Button>
              <Button className="w-full" variant="outline" onClick={() => router.push('/history')}>
                View History
              </Button>
              {!hasValidWallet && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-800">
                    <strong>Wallet Not Configured:</strong> Please contact support to configure your Starknet wallet 
                    address before using the fund account feature.
                  </p>
                </div>
              )}
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
                {finalDisplayWallet ? (
                  <div>
                    <p className="text-sm font-mono text-muted-foreground break-all">
                      {finalDisplayWallet}
                    </p>
                    {!hasValidWallet && (
                      <p className="text-xs text-yellow-600 mt-1">
                        Demo address - Contact support to configure your wallet
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-yellow-600">
                    Not configured - Please contact support
                  </p>
                )}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Fund Account Modal */}
      {showFundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Fund Your Account</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFundModal(false)}
                  className="h-8 w-8 p-0"
                >
                  ×
                </Button>
              </div>

              <div className="space-y-6">
                {/* Wallet Address Section */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Your Wallet Address</Label>
                  {finalDisplayWallet ? (
                    <>
                      <div className="flex items-center space-x-2">
                        <Input
                          value={finalDisplayWallet}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(finalDisplayWallet)
                            // You could add a toast notification here
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {hasValidWallet 
                          ? 'Copy this address to send funds from any Starknet wallet'
                          : 'Demo wallet address - Please contact support to configure your actual wallet'
                        }
                      </p>
                      {!hasValidWallet && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                          <p className="text-xs text-blue-700">
                            <strong>Note:</strong> This is a demo address. To use the fund account feature, 
                            please contact support to configure your actual Starknet wallet address.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800">
                        Wallet address not configured. Please contact support or try logging out and back in.
                      </p>
                    </div>
                  )}
                </div>

                {/* Chain Info */}
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">Starknet {showNGN ? 'Sepolia' : 'Sepolia'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Network: Sepolia Testnet
                  </p>
                </div>

                {/* 3-Step Process */}
                <div className="space-y-4">
                  <h3 className="font-medium">How to Fund Your Account:</h3>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                        1
                      </div>
                      <div>
                        <p className="text-sm font-medium">Copy your wallet address</p>
                        <p className="text-xs text-muted-foreground">Use the copy button above</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                        2
                      </div>
                      <div>
                        <p className="text-sm font-medium">Send funds from your wallet</p>
                        <p className="text-xs text-muted-foreground">Use any Starknet wallet (Argent, Braavos, etc.)</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                        3
                      </div>
                      <div>
                        <p className="text-sm font-medium">Wait for confirmation</p>
                        <p className="text-xs text-muted-foreground">Funds will appear in your dashboard within minutes</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* What Happens After Funding */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">After Funding:</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• Your USDC and STRK balances will update automatically</li>
                    <li>• You can withdraw funds to your Nigerian bank account</li>
                    <li>• All transactions are recorded in your history</li>
                  </ul>
                </div>

                <Button 
                  className="w-full" 
                  onClick={() => setShowFundModal(false)}
                >
                  Got It
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}