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
import { ArrowLeft, DollarSign, CreditCard, AlertCircle, CheckCircle } from "lucide-react"
import { z } from "zod"
import { withdrawalSchema, type WithdrawalFormData } from "@/lib/schemas"
import { cookies } from "@/lib/cookies"

interface BankAccount {
  id: string
  bankName: string
  accountNumber: string
  accountName: string
}

interface WithdrawalRequest {
  id: string
  amountUSD: number
  amountNGN: number
  bankAccount: BankAccount
  status: string
  createdAt: string
  estimatedCompletion: string
}

export default function WithdrawPage() {
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [selectedBankAccount, setSelectedBankAccount] = useState("")
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [withdrawalRequest, setWithdrawalRequest] = useState<WithdrawalRequest | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [balance, setBalance] = useState<{ usd: number; ngn: number }>({ usd: 0, ngn: 0 })
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const token = cookies.get('jwt')
      if (!token) {
        router.push('/login')
        return
      }

      try {
        // Get user balance
        const balanceRes = await api.user.balance(token)
        setBalance(balanceRes.data)

        // Get bank accounts
        const accountsRes = await api.user.bankAccounts(token)
        setBankAccounts(accountsRes.data)
        
        if (accountsRes.data.length > 0) {
          setSelectedBankAccount(accountsRes.data[0].id)
        }
      } catch (err: any) {
        console.error('Failed to load data:', err)
        setError('Failed to load account information')
      }
    }

    checkAuth()
  }, [router])

  const validateForm = (data: any) => {
    try {
      withdrawalSchema.parse(data)
      setFormErrors({})
      return true
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {}
        err.issues.forEach((issue: any) => {
          if (issue.path) {
            errors[issue.path[0] as string] = issue.message
          }
        })
        setFormErrors(errors)
      }
      return false
    }
  }

  const getFieldError = (fieldName: string) => {
    return formErrors[fieldName] || ""
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setFormErrors({})

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount")
      return
    }

    if (!selectedBankAccount) {
      setError("Please select a bank account")
      return
    }

    const amountNum = parseFloat(amount)
    if (currency === "USD" && amountNum > balance.usd) {
      setError("Insufficient USD balance")
      return
    }

    if (currency === "NGN" && amountNum > balance.ngn) {
      setError("Insufficient NGN balance")
      return
    }

    const formData = {
      amount: amountNum,
      currency,
      bankAccountId: selectedBankAccount,
      description: `Withdrawal to bank account`
    }

    if (!validateForm(formData)) {
      return
    }

    setLoading(true)

    try {
      const token = cookies.get('jwt')
      if (!token) {
        setError('Authentication token not found')
        return
      }

      const response = await api.starknet.withdraw(formData, token)
      setWithdrawalRequest(response.data)
    } catch (err: any) {
      console.error('Withdrawal failed:', err)
      setError(err.message || 'Withdrawal failed')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === "NGN") {
      return `₦${amount.toLocaleString()}`
    }
    return `$${amount.toLocaleString()}`
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'text-yellow-600'
      case 'processing':
        return 'text-blue-600'
      case 'completed':
        return 'text-green-600'
      case 'failed':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  if (withdrawalRequest) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Button 
            variant="ghost" 
            className="mb-6"
            onClick={() => setWithdrawalRequest(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            New Withdrawal
          </Button>

          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl">Withdrawal Request Submitted!</CardTitle>
                <CardDescription>
                  Your withdrawal request has been submitted and is being processed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Request ID</Label>
                    <p className="text-sm font-mono text-muted-foreground mt-1">
                      {withdrawalRequest.id}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <p className={`text-sm font-medium mt-1 capitalize ${getStatusColor(withdrawalRequest.status)}`}>
                      {withdrawalRequest.status}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Amount (USD)</Label>
                    <p className="text-lg font-semibold mt-1">
                      ${withdrawalRequest.amountUSD.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Amount (NGN)</Label>
                    <p className="text-lg font-semibold mt-1">
                      ₦{withdrawalRequest.amountNGN.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Bank Account</Label>
                  <div className="bg-muted p-3 rounded-lg mt-2">
                    <p className="font-medium">{withdrawalRequest.bankAccount.bankName}</p>
                    <p className="text-sm text-muted-foreground">
                      {withdrawalRequest.bankAccount.accountName} - {withdrawalRequest.bankAccount.accountNumber}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Submitted</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(withdrawalRequest.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Estimated Completion</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(withdrawalRequest.estimatedCompletion).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">Processing Time</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Bank transfers typically take 1-3 business days to complete. You'll receive a notification once the funds are credited to your account.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button 
                    onClick={() => router.push('/dashboard')} 
                    className="flex-1"
                  >
                    Back to Dashboard
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => router.push('/history')}
                    className="flex-1"
                  >
                    View History
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Withdraw Funds</h1>
            <p className="text-muted-foreground">
              Withdraw your funds to your bank account
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Withdrawal Details</CardTitle>
                  <CardDescription>
                    Enter the amount you want to withdraw and select your bank account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {error && (
                    <div className="text-red-500 text-sm text-center mb-4">{error}</div>
                  )}

                  <form onSubmit={handleWithdraw} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          required
                          className={getFieldError('amount') ? 'border-red-500' : ''}
                        />
                        {getFieldError('amount') && (
                          <p className="text-red-500 text-xs">{getFieldError('amount')}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="currency">Currency</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="NGN">NGN</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bankAccount">Bank Account</Label>
                      {bankAccounts.length > 0 ? (
                        <Select value={selectedBankAccount} onValueChange={setSelectedBankAccount}>
                          <SelectTrigger className={getFieldError('bankAccountId') ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select bank account" />
                          </SelectTrigger>
                          <SelectContent>
                            {bankAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.bankName} - {account.accountName} ({account.accountNumber})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-center py-8 border-2 border-dashed border-muted-foreground rounded-lg">
                          <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground mb-2">No bank accounts found</p>
                          <Button 
                            variant="outline" 
                            onClick={() => router.push('/dashboard')}
                          >
                            Add Bank Account
                          </Button>
                        </div>
                      )}
                      {getFieldError('bankAccountId') && (
                        <p className="text-red-500 text-xs">{getFieldError('bankAccountId')}</p>
                      )}
                    </div>

                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Available Balance</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">USD:</span>
                          <span className="ml-2 font-medium">
                            ${balance.usd.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">NGN:</span>
                          <span className="ml-2 font-medium">
                            ₦{balance.ngn.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading || bankAccounts.length === 0}>
                      {loading ? "Processing..." : "Withdraw Funds"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Withdrawal Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Processing Time</h4>
                    <p className="text-sm text-muted-foreground">
                      Bank transfers typically take 1-3 business days
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Fees</h4>
                    <p className="text-sm text-muted-foreground">
                      No withdrawal fees for amounts above $10
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Minimum Amount</h4>
                    <p className="text-sm text-muted-foreground">
                      $10 USD or ₦10,000 NGN
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Need Help?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    If you have any questions about withdrawals, contact our support team.
                  </p>
                  <Button variant="outline" className="w-full">
                    Contact Support
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
