import { z } from "zod"

// Login form validation
export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters")
})

// Personal info validation for onboarding
export const personalInfoSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().min(10, "Please enter a valid phone number")
})

// Bank details validation for onboarding
export const bankDetailsSchema = z.object({
  bankName: z.string().min(1, "Please select a bank"),
  accountNumber: z.string()
    .length(10, "Account number must be exactly 10 digits")
    .regex(/^[0-9]+$/, "Account number must contain only numbers"),
  accountName: z.string().min(2, "Account name must be at least 2 characters")
})

// Withdrawal form validation
export const withdrawalSchema = z.object({
  amount: z.number().min(0.01, "Amount must be at least $0.01"),
  currency: z.enum(["USD", "NGN"]),
  bankAccountId: z.string().min(1, "Please select a bank account"),
  description: z.string().min(1, "Description is required")
})

// Payment request validation
export const paymentRequestSchema = z.object({
  amount: z.number().min(0.01, "Amount must be at least $0.01"),
  currency: z.enum(["USD", "NGN"]),
  description: z.string().min(1, "Description is required")
})

// User profile update validation
export const userProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Please enter a valid phone number")
})

// Bank account validation
export const bankAccountSchema = z.object({
  bankName: z.string().min(1, "Please select a bank"),
  accountNumber: z.string()
    .length(10, "Account number must be exactly 10 digits")
    .regex(/^[0-9]+$/, "Account number must contain only numbers"),
  accountName: z.string().min(2, "Account name must be at least 2 characters")
})

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>
export type PersonalInfoData = z.infer<typeof personalInfoSchema>
export type BankDetailsData = z.infer<typeof bankDetailsSchema>
export type WithdrawalFormData = z.infer<typeof withdrawalSchema>
export type PaymentRequestData = z.infer<typeof paymentRequestSchema>
export type UserProfileData = z.infer<typeof userProfileSchema>
export type BankAccountData = z.infer<typeof bankAccountSchema>
