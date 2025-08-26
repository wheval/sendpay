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
import { ArrowLeft, QrCode, Copy, Share2, Download, DollarSign } from "lucide-react"
import { cookies } from "@/lib/cookies"

interface PaymentRequest {
  reference: string
  amountUSD: number
  amountNGN: number
  description: string
  status: string
  createdAt: string
  expiresAt: string
}

export default function ReceivePage() {
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [description, setDescription] = useState("")
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const token = cookies.get('jwt')
    if (!token) {
      router.push('/login')
      return
    }
  }, [router])

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount")
      return
    }

    setLoading(true)
    setError("")

    try {
      const token = cookies.get('jwt')
      if (!token) {
        setError('Authentication token not found')
        return
      }
      
      const data = {
        amount: parseFloat(amount),
        currency,
        description: description || `Payment request for ${currency} ${amount}`,
        expiresIn: 24 * 60 * 60 // 24 hours in seconds
      }

      const response = await api.payment.receive(data, token)
      setPaymentRequest(response.data)
    } catch (err: any) {
      console.error('Failed to create payment request:', err)
      setError(err.message || 'Failed to create payment request')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (paymentRequest) {
      const link = `${window.location.origin}/pay/${paymentRequest.reference}`
      try {
        await navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
  }

  const handleShare = async () => {
    if (paymentRequest && navigator.share) {
      const link = `${window.location.origin}/pay/${paymentRequest.reference}`
      try {
        await navigator.share({
          title: 'Payment Request',
          text: `Please pay ${currency} ${amount} via SendPay`,
          url: link
        })
      } catch (err) {
        console.error('Failed to share:', err)
      }
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === "NGN") {
      return `₦${amount.toLocaleString()}`
    }
    return `$${amount.toLocaleString()}`
  }

  if (paymentRequest) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Button 
            variant="ghost" 
            className="mb-6"
            onClick={() => setPaymentRequest(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Create New Request
          </Button>

          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Payment Request Created!</CardTitle>
                <CardDescription>
                  Share this link with the person you want to receive payment from
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <QrCode className="w-24 h-24 text-gray-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    QR Code for {formatCurrency(paymentRequest.amountUSD, "USD")} / {formatCurrency(paymentRequest.amountNGN, "NGN")}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Payment Link</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      <Input 
                        value={`${window.location.origin}/pay/${paymentRequest.reference}`}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleCopyLink}
                      >
                        {copied ? "Copied!" : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Reference</Label>
                      <p className="text-sm font-mono text-muted-foreground mt-1">
                        {paymentRequest.reference}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Status</Label>
                      <p className="text-sm text-muted-foreground mt-1 capitalize">
                        {paymentRequest.status}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Amount (USD)</Label>
                      <p className="text-lg font-semibold mt-1">
                        ${paymentRequest.amountUSD.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Amount (NGN)</Label>
                      <p className="text-lg font-semibold mt-1">
                        ₦{paymentRequest.amountNGN.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {paymentRequest.description && (
                    <div>
                      <Label className="text-sm font-medium">Description</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {paymentRequest.description}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Created</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(paymentRequest.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Expires</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(paymentRequest.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button onClick={handleShare} className="flex-1">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download QR
                  </Button>
                </div>

                <div className="text-center">
                  <Button 
                    variant="link" 
                    onClick={() => router.push('/dashboard')}
                  >
                    Back to Dashboard
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
            <h1 className="text-3xl font-bold">Receive Payment</h1>
            <p className="text-muted-foreground">
              Create a payment request and share it with others to receive money
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Create Payment Request</CardTitle>
              <CardDescription>
                Set the amount and description for your payment request
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="text-red-500 text-sm text-center mb-4">{error}</div>
              )}

              <form onSubmit={handleCreateRequest} className="space-y-6">
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
                    />
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
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    placeholder="What is this payment for?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Estimated Conversion</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">USD:</span>
                      <span className="ml-2 font-medium">
                        ${amount ? parseFloat(amount).toFixed(2) : '0.00'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">NGN:</span>
                      <span className="ml-2 font-medium">
                        ₦{amount ? (parseFloat(amount) * 1000).toLocaleString() : '0'}
                      </span>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating Request..." : "Create Payment Request"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
