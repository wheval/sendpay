"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Mail, Lock, User, CreditCard, Building2 } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/api"
import { useRouter } from "next/navigation"
import Navigation from "@/components/navigation"
import { z } from "zod"
import { 
  loginSchema, 
  personalInfoSchema, 
  bankDetailsSchema,
  type LoginFormData,
  type PersonalInfoData,
  type BankDetailsData
} from "@/lib/schemas"
import { useToast } from "@/hooks/use-toast"
import { cookies } from "@/lib/cookies"
import { getActiveBanks } from "@/lib/constants"

export default function LoginPage() {
  const [isOnboarding, setIsOnboarding] = useState(false)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  
  // Form state for controlled inputs
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")
  
  const { toast } = useToast()
  const router = useRouter()

  const validateForm = (schema: z.ZodSchema, data: any) => {
    try {
      schema.parse(data)
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

  const handleEmailPasswordLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setFormErrors({})
    
    const formData = {
      email,
      password
    }
    
    if (!validateForm(loginSchema, formData)) {
      setLoading(false)
      return
    }

    try {
      const res = await api.cavos.login(formData.email, formData.password)
      const data = res.data
      
      // Store tokens in cookies (more secure than localStorage)
      if (res.token) {
        cookies.set('jwt', res.token, 7) // 7 days
      }
      cookies.set('accessToken', data.access_token, 1) // 1 day
      cookies.set('refreshToken', data.refresh_token, 30) // 30 days
      cookies.set('walletAddress', data.wallet?.address || '', 7)
      
      // Store user info
      if (res.user) {
        cookies.set('user', JSON.stringify(res.user), 7)
      }
      
      toast({
        title: "Login successful!",
        description: "Welcome back to SendPay",
        variant: "success",
      })
      
      // Reset form for onboarding
      resetForm()
      setIsOnboarding(true)
    } catch (err: any) {
      console.error('Login failed', err)
      
      // Parse error message for user-friendly display
      let errorMessage = 'Login failed. Please check your credentials.'
      
      if (err.message) {
        try {
          // Try to parse the error message from the backend
          if (err.message.includes('401')) {
            errorMessage = 'Invalid email or password. Please try again.'
          } else if (err.message.includes('Unauthorized')) {
            errorMessage = 'Authentication failed. Please check your credentials.'
          } else if (err.message.includes('signIn failed')) {
            errorMessage = 'Account not found. Please check your email or sign up.'
          } else {
            errorMessage = err.message
          }
        } catch {
          // If parsing fails, use the original message
          errorMessage = err.message
        }
      }
      
      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step < 3) {
      // Validate current step before proceeding
      if (step === 1) {
        const personalData = {
          fullName,
          phone
        }
        if (!validateForm(personalInfoSchema, personalData)) {
          return
        }
      } else if (step === 2) {
        const bankData = {
          bankName,
          accountNumber,
          accountName
        }
        if (!validateForm(bankDetailsSchema, bankData)) {
          return
        }
      }
      
      setStep(step + 1)
    } else {
      // Complete onboarding
      try {
        const onboardingData = {
          name: fullName,
          phone,
          bankDetails: {
            bankName,
            accountNumber,
            accountName
          }
        }
        
        const token = cookies.get('jwt')
        if (!token) {
          toast({
            title: "Authentication error",
            description: "Please log in again",
            variant: "destructive",
          })
          return
        }
        
        await api.auth.onboarding(onboardingData, token)
        
        toast({
          title: "Onboarding complete!",
          description: "Your account is now set up",
          variant: "success",
        })
        
        // Redirect to dashboard
        router.push('/dashboard')
      } catch (err: any) {
        console.error('Onboarding failed', err)
        
        let errorMessage = 'Onboarding failed. Please try again.'
        if (err.message) {
          errorMessage = err.message
        }
        
        toast({
          title: "Onboarding failed",
          description: errorMessage,
          variant: "destructive",
        })
      }
    }
  }

  const getFieldError = (fieldName: string) => {
    return formErrors[fieldName] || ""
  }

  const resetForm = () => {
    setEmail("")
    setPassword("")
    setFullName("")
    setPhone("")
    setBankName("")
    setAccountNumber("")
    setAccountName("")
    setFormErrors({})
  }

  const clearFieldError = (fieldName: string) => {
    if (formErrors[fieldName]) {
      setFormErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldName]
        return newErrors
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-md mx-auto">
          {!isOnboarding ? (
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Welcome to SendPay</CardTitle>
                <CardDescription>
                  Sign in to your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">

                <form className="space-y-4" onSubmit={handleEmailPasswordLogin}>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="Enter your email" 
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        clearFieldError('email')
                      }}
                      required 
                      className={getFieldError('email') ? 'border-red-500' : ''}
                    />
                    {getFieldError('email') && (
                      <p className="text-red-500 text-xs">{getFieldError('email')}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="Enter your password" 
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        clearFieldError('password')
                      }}
                      required 
                      className={getFieldError('password') ? 'border-red-500' : ''}
                    />
                    {getFieldError('password') && (
                      <p className="text-red-500 text-xs">{getFieldError('password')}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing In..." : "Sign In"}
                  </Button>
                </form>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">Don&apos;t have an account? </span>
                  <Button variant="link" className="p-0 h-auto" onClick={() => setIsOnboarding(true)}>
                    Sign up
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="text-center">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="absolute left-4 top-4"
                  onClick={() => {
                    setIsOnboarding(false)
                    resetForm()
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
                <CardDescription>
                  Step {step} of 3: {step === 1 ? "Personal Info" : step === 2 ? "Bank Details" : "Verification"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleOnboardingSubmit} className="space-y-4">
                  {step === 1 && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input 
                          id="fullName" 
                          placeholder="Enter your full name" 
                          value={fullName}
                          onChange={(e) => {
                            setFullName(e.target.value)
                            clearFieldError('fullName')
                          }}
                          required 
                          className={getFieldError('fullName') ? 'border-red-500' : ''}
                        />
                        {getFieldError('fullName') && (
                          <p className="text-red-500 text-xs">{getFieldError('fullName')}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input 
                          id="phone" 
                          type="tel" 
                          placeholder="Enter your phone number" 
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value)
                            clearFieldError('phone')
                          }}
                          required 
                          className={getFieldError('phone') ? 'border-red-500' : ''}
                        />
                        {getFieldError('phone') && (
                          <p className="text-red-500 text-xs">{getFieldError('phone')}</p>
                        )}
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="bankName">Bank Name</Label>
                        <Select 
                          value={bankName} 
                          onValueChange={(value) => {
                            setBankName(value)
                            clearFieldError('bankName')
                          }} 
                          required
                        >
                          <SelectTrigger className={getFieldError('bankName') ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select your bank" />
                          </SelectTrigger>
                          <SelectContent>
                            {getActiveBanks().map((bank) => (
                              <SelectItem key={bank.code} value={bank.code}>
                                {bank.shortName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {getFieldError('bankName') && (
                          <p className="text-red-500 text-xs">{getFieldError('bankName')}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accountNumber">Account Number</Label>
                        <Input 
                          id="accountNumber" 
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]{10}"
                          maxLength={10}
                          placeholder="Enter 10-digit account number" 
                          value={accountNumber}
                          onChange={(e) => {
                            // Only allow numbers
                            const value = e.target.value.replace(/[^0-9]/g, '')
                            setAccountNumber(value)
                            clearFieldError('accountNumber')
                          }}
                          required 
                          className={getFieldError('accountNumber') ? 'border-red-500' : ''}
                          onKeyPress={(e) => {
                            if (!/[0-9]/.test(e.key)) {
                              e.preventDefault()
                            }
                          }}
                        />
                        {getFieldError('accountNumber') && (
                          <p className="text-red-500 text-xs">{getFieldError('accountNumber')}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Nigerian bank account numbers are exactly 10 digits
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accountName">Account Name</Label>
                        <Input 
                          id="accountName" 
                          placeholder="Enter your account name" 
                          value={accountName}
                          onChange={(e) => {
                            setAccountName(e.target.value)
                            clearFieldError('accountName')
                          }}
                          required 
                          className={getFieldError('accountName') ? 'border-red-500' : ''}
                        />
                        {getFieldError('accountName') && (
                          <p className="text-red-500 text-xs">{getFieldError('accountName')}</p>
                        )}
                      </div>
                    </>
                  )}

                  {step === 3 && (
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Almost Done!</h3>
                        <p className="text-muted-foreground">Your account is being set up. You&apos;ll be redirected to the dashboard shortly.</p>
                      </div>
                    </div>
                  )}

                  {step < 3 && (
                    <Button type="submit" className="w-full">
                      {step === 2 ? "Complete Setup" : "Next Step"}
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
