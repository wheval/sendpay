"use client"

import { useState, useEffect } from "react"
import Navigation from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api"
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, Download, Eye, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { cookies } from "@/lib/cookies"

interface Transaction {
  id: string
  flow: 'onramp' | 'offramp'
  amountUSD: number
  amountNGN: number
  description: string
  status:
    | 'created'
    | 'signed'
    | 'submitted_onchain'
    | 'event_emitted'
    | 'payout_pending'
    | 'payout_completed'
    | 'payout_failed'
    | 'credit_pending'
    | 'credited'
    | 'credit_failed'
  createdAt: string
  updatedAt: string
  reference?: string
  bankDetails?: {
    bankName?: string
    accountNumber?: string
    accountName?: string
  }
}

interface TransactionSummary {
  totalReceived: number
  totalWithdrawn: number
  totalTransfers: number
  pendingAmount: number
  completedAmount: number
}
//TODO: allow contract handle some of these stuff
export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<TransactionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const token = cookies.get('jwt') || localStorage.getItem('jwt')
      if (!token) {
        router.push('/login')
        return
      }

      try {
        // Get transaction history (prefer data.transactions)
        const historyRes = await api.transaction.history(token)
        const items = historyRes.data?.transactions || historyRes.history || historyRes.data || []
        setTransactions(Array.isArray(items) ? items : [])

        // Get transaction summary and normalize to UI shape
        const summaryRes = await api.transaction.summary(token)
        const stats = summaryRes.data?.statistics || summaryRes.summary || summaryRes.data || null
        if (stats) {
          setSummary({
            totalReceived: Number(stats.totalReceivedUSD) || 0,
            totalWithdrawn: Number(stats.totalWithdrawnUSD) || 0,
            totalTransfers: Number(stats.totalTransactions) || 0,
            pendingAmount: Number(stats.pendingCount) || 0,
            completedAmount: Number(stats.completedCount) || 0,
          })
        } else {
          setSummary(null)
        }
      } catch (err: unknown) {
        setTransactions([])
        setSummary(null)
        const msg = err instanceof Error ? err.message : ''
        if (!msg.includes('404')) {
          setError('Failed to load transaction history')
        }
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  const isPendingGroup = (status: Transaction['status']) => (
    [
      'created',
      'signed',
      'submitted_onchain',
      'event_emitted',
      'payout_pending',
      'credit_pending',
    ] as Transaction['status'][]
  ).includes(status)

  const isCompletedGroup = (status: Transaction['status']) => (
    [
      'credited',
      'payout_completed',
    ] as Transaction['status'][]
  ).includes(status)

  const isFailedGroup = (status: Transaction['status']) => (
    [
      'credit_failed',
      'payout_failed',
    ] as Transaction['status'][]
  ).includes(status)

  const filteredTransactions = (Array.isArray(transactions) ? transactions : []).filter(transaction => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.reference?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = (() => {
      if (statusFilter === 'all') return true
      if (statusFilter === 'pending') return isPendingGroup(transaction.status)
      if (statusFilter === 'completed') return isCompletedGroup(transaction.status)
      if (statusFilter === 'failed') return isFailedGroup(transaction.status)
      if (statusFilter === 'cancelled') return false
      return true
    })()
    const matchesType = (() => {
      if (typeFilter === 'all') return true
      if (typeFilter === 'received') return transaction.flow === 'onramp'
      if (typeFilter === 'withdrawn') return transaction.flow === 'offramp'
      return true
    })()
    
    let matchesDate = true
    if (dateFilter !== "all") {
      const transactionDate = new Date(transaction.createdAt)
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - transactionDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      switch (dateFilter) {
        case "today":
          matchesDate = diffDays <= 1
          break
        case "week":
          matchesDate = diffDays <= 7
          break
        case "month":
          matchesDate = diffDays <= 30
          break
      }
    }

    return matchesSearch && matchesStatus && matchesType && matchesDate
  })

  const getStatusIcon = (status: Transaction['status']) => {
    if (isCompletedGroup(status)) return <CheckCircle className="h-4 w-4 text-green-600" />
    if (isFailedGroup(status)) return <XCircle className="h-4 w-4 text-red-600" />
    if (isPendingGroup(status)) return <Clock className="h-4 w-4 text-yellow-600" />
    return <AlertCircle className="h-4 w-4 text-blue-600" />
  }

  const getStatusColor = (status: Transaction['status']) => {
    if (isCompletedGroup(status)) return 'text-green-600'
    if (isFailedGroup(status)) return 'text-red-600'
    if (isPendingGroup(status)) return 'text-yellow-600'
    return 'text-blue-600'
  }

  const getTypeIcon = (flow: 'onramp' | 'offramp' | string) => {
    switch (flow) {
      case 'onramp':
        return <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
          <span className="text-green-600 font-bold text-sm">+</span>
        </div>
      case 'offramp':
        return <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
          <span className="text-red-600 font-bold text-sm">-</span>
        </div>
      default:
        return <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <span className="text-blue-600 font-bold text-sm">→</span>
        </div>
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === "NGN") {
      return `₦${amount.toLocaleString()}`
    }
    return `$${amount.toLocaleString()}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return "Today"
    if (diffDays === 2) return "Yesterday"
    if (diffDays <= 7) return `${diffDays - 1} days ago`
    if (diffDays <= 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  const handleExport = () => {
    // Export functionality would go here
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full container">
          <div className="flex justify-between items-center mb-8">
            <div>
              <div className="h-8 w-48 bg-muted rounded animate-pulse" />
              <div className="h-4 w-64 bg-muted rounded mt-2 animate-pulse" />
            </div>
            <div className="h-9 w-36 bg-muted rounded animate-pulse" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                  <div className="h-6 w-6 bg-muted rounded-full animate-pulse" />
                </div>
                <div className="h-7 w-24 bg-muted rounded mb-2 animate-pulse" />
                <div className="h-3 w-32 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>

          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-6 w-40 bg-muted rounded animate-pulse" />
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-48 bg-muted rounded mb-2 animate-pulse" />
                    <div className="h-3 w-64 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-6 w-20 bg-muted rounded animate-pulse" />
                </div>
              ))}
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

  return (
    <div className="min-h-screen bg-background">
      <Navigation landing={false} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Transaction History</h1>
            <p className="text-muted-foreground">
              View all your transaction history and activity
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Received</CardTitle>
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-bold text-sm">+</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${summary.totalReceived.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  ₦{(summary.totalReceived * 1000).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Withdrawn</CardTitle>
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-bold text-sm">-</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${summary.totalWithdrawn.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  ₦{(summary.totalWithdrawn * 1000).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${summary.pendingAmount.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  ₦{(summary.pendingAmount * 1000).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${summary.completedAmount.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  ₦{(summary.completedAmount * 1000).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search transactions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date Range</Label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button onClick={handleExport} variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              {filteredTransactions.length} of {transactions.length} transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No transactions found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {getTypeIcon(transaction.flow)}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium truncate">{transaction.description}</p>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <span>{formatDate(transaction.createdAt)}</span>
                            {transaction.reference && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{transaction.reference}</span>
                              </>
                            )}
                          </div>
                          {transaction.bankDetails && (
                            <p className="text-sm text-muted-foreground">
                              {transaction.bankDetails.bankName} - {transaction.bankDetails.accountName}
                            </p>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            <div className="text-right flex items-center gap-1">
                              <p className="font-medium">
                                {transaction.flow === 'offramp' ? '-' : '+'}
                                {formatCurrency(transaction.amountUSD, 'USD')}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatCurrency(transaction.amountNGN, 'NGN')}
                              </p>
                            </div>
                          </div>
                          <p className={`text-sm font-medium flex items-center gap-1 capitalize ${getStatusColor(transaction.status)}`}>
                            {getStatusIcon(transaction.status)}
                            {String(transaction.status).replace(/_/g, ' ')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
