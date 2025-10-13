"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { CreatePinModal } from "@/components/CreatePinModal";
import {
	ArrowLeft,
	Eye,
	EyeOff,
	Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { SUPPORTED_BANKS, Bank } from "@/lib/constants";
import { useRouter } from "next/navigation";
import Navigation from "@/components/navigation";
import { z } from "zod";
import {
	loginSchema,
	personalInfoSchema,
	bankDetailsSchema,
} from "@/lib/schemas";
import { useToast } from "@/hooks/use-toast";
import { cookies } from "@/lib/cookies";



export default function LoginPage() {
	const [isOnboarding, setIsOnboarding] = useState(false);
	const [isSignup, setIsSignup] = useState(false);
	const [step, setStep] = useState(2); // Start at step 2 (skip name/phone for now)
	const [loading, setLoading] = useState(false);
	const [formErrors, setFormErrors] = useState<Record<string, string>>({});

	// Password visibility states
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	// Form state for controlled inputs
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [fullName, setFullName] = useState("");
	const [phone, setPhone] = useState("");
	const [bankCode, setBankCode] = useState("");
	const [bankName, setBankName] = useState("");
	const [accountNumber, setAccountNumber] = useState("");
	const [accountName, setAccountName] = useState("");

  // Banks state - using static list instead of API fetch
  	const [banks] = useState<Bank[]>(SUPPORTED_BANKS);

  // Create options for Combobox
  const bankOptions = useMemo(() => 
    banks.map((bank) => ({
      value: bank.code,
      label: bank.name
    })),
    [banks]
  );
	
	// Bank verification state
	const [verifyingAccount, setVerifyingAccount] = useState(false);
	const [accountVerified, setAccountVerified] = useState(false);
	const [verificationError, setVerificationError] = useState("");
	
	// Wallet creation state
	const [showCreateWallet, setShowCreateWallet] = useState(false);
	const [walletCreated, setWalletCreated] = useState(false);

	const { toast } = useToast();
	const router = useRouter();

	// Clear field error function
	const clearFieldError = useCallback((fieldName: string) => {
		if (formErrors[fieldName]) {
			setFormErrors((prev) => {
				const newErrors = { ...prev };
				delete newErrors[fieldName];
				return newErrors;
			});
		}
	}, [formErrors]);


	// Check for onboarding parameter in URL
	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		if (urlParams.get('onboarding') === 'true') {
			setIsOnboarding(true);
			setStep(2); // Start at step 2 (bank account setup)
			toast({
				title: "Complete Your Profile",
				description: "Please complete your profile setup to access the dashboard",
				variant: "default",
			});
		}
	}, [toast]);

	// Handle bank selection
	const handleBankSelection = (selectedBankCode: string) => {
		setBankCode(selectedBankCode);
		const selectedBank = banks.find(bank => bank.code === selectedBankCode);
		if (selectedBank) {
			setBankName(selectedBank.name);
		}
		clearFieldError("bankCode");
		// Reset verification when bank changes
		setAccountVerified(false);
		setAccountName("");
		setVerificationError("");
	};

	// Verify bank account
	const verifyBankAccount = useCallback(async (accountNumber: string, bankCode: string) => {
		if (!accountNumber || !bankCode || accountNumber.length !== 10) {
			return;
		}

		setVerifyingAccount(true);
		setVerificationError("");
		try {
			const token = cookies.get("jwt");
			if (!token) {
				throw new Error("Authentication required");
			}

			const response = await api.flutterwave.verifyAccount({
				accountNumber,
				accountBank: bankCode
			}, token);

            if (response.success && response.data) {
				const verifiedAccountName = response.data.account_name;
				setAccountName(verifiedAccountName);
				setAccountVerified(true);
				setVerificationError("");
				clearFieldError("accountNumber");
				
              // Persist bank details by linking bank account (saves account and details server-side)
              try {
                await api.flutterwave.addBank({
                  bankCode,
                  accountNumber,
                  accountName: verifiedAccountName,
                  bankName
                }, token);
                // Refresh profile cache so onboarding hides
                const refreshed = await api.user.profile(token);
                if (refreshed?.user) {
                  cookies.set("user", JSON.stringify(refreshed.user), 7);
                  localStorage.setItem("user", JSON.stringify(refreshed.user));
                }
              } catch {}

				toast({
					title: "Account Verified!",
					description: `Account name: ${verifiedAccountName}`,
					variant: "success",
				});
			} else {
				throw new Error(response.message || "Account verification failed");
			}
		} catch (error) {
			console.error('Account verification failed:', error);
			setAccountVerified(false);
			setAccountName("");
			
			let errorMessage = "Unable to verify, check your account number";
            if (error instanceof Error) {
                errorMessage = error.message || "Unable to verify, check your account number";
            }
			setVerificationError(errorMessage);
			
			toast({
				title: "Verification Failed",
				description: errorMessage,
				variant: "destructive",
			});
		} finally {
			setVerifyingAccount(false);
		}
	}, [toast, clearFieldError]);

	// Debounced verification function
	const debouncedVerifyAccount = useMemo(() => {
		let timeoutId: NodeJS.Timeout;
		return (accountNumber: string, bankCode: string) => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				if (accountNumber.length === 10 && bankCode) {
					verifyBankAccount(accountNumber, bankCode);
				}
			}, 800);
		};
	}, [verifyBankAccount]);

	// No longer need bankOptions since we use a simple select

	const validateForm = (schema: z.ZodSchema, data: unknown) => {
		try {
			schema.parse(data);
			setFormErrors({});
			return true;
		} catch (err) {
			if (err instanceof z.ZodError) {
				const errors: Record<string, string> = {};
				err.issues.forEach((issue) => {
					if (issue.path) {
						errors[issue.path[0] as string] = issue.message;
					}
				});
				setFormErrors(errors);
			}
			return false;
		}
	};

	const handleEmailPasswordLogin = async (
		e: React.FormEvent<HTMLFormElement>
	) => {
		e.preventDefault();
		setLoading(true);
		setFormErrors({});

		const formData = {
			email,
			password,
		};

		if (!validateForm(loginSchema, formData)) {
			setLoading(false);
			return;
		}

		try {
			const res = await api.auth.login(formData.email, formData.password);
			// Store JWT token in cookies
			if (res.token) {
				cookies.set("jwt", res.token, 7); // 7 days
			}

			// Store user info
			if (res.user) {
				cookies.set("user", JSON.stringify(res.user), 7);
				localStorage.setItem("user", JSON.stringify(res.user));
			}

			toast({
				title: "Login successful!",
				description: "Welcome back to SendPay",
				variant: "success",
			});

            // Always fetch fresh profile to avoid stale flags in login response
            type ProfileUser = {
                chipiWalletAddress?: string;
                bankDetails?: {
                    bankName?: string;
                    bankCode?: string;
                    accountNumber?: string;
                    accountName?: string;
                };
            };
            const token = cookies.get("jwt");
            const profile = token ? await api.user.profile(token) : null;
            const user: ProfileUser | undefined = (profile?.user as ProfileUser) || (res.user as ProfileUser);

            if (user) {
                cookies.set("user", JSON.stringify(user), 7);
                localStorage.setItem("user", JSON.stringify(user));
            }

            // Compute onboarding need based on wallet + bank fields (best-effort)
            const hasWallet = Boolean(user?.chipiWalletAddress);
            const bd = user?.bankDetails || {};
            const hasBank = Boolean(bd.bankName && bd.bankCode && bd.accountNumber && bd.accountName);

            if (!hasWallet || !hasBank) {
                // Reset form for onboarding
                resetForm();
                setEmail(formData.email);
                setIsOnboarding(true);
                setStep(2); // bank account step first
            } else {
                router.push("/dashboard");
            }
		} catch (err: unknown) {
			console.error("Login failed", err);

			// Parse error message for user-friendly display
			let errorMessage = "Login failed. Please check your credentials.";

			if (err instanceof Error && err.message) {
				try {
					// Try to parse the error message from the backend
					if (err.message.includes("401")) {
						errorMessage = "Invalid email or password. Please try again.";
					} else if (err.message.includes("Unauthorized")) {
						errorMessage =
							"Authentication failed. Please check your credentials.";
					} else if (err.message.includes("signIn failed")) {
						errorMessage =
							"Account not found. Please check your email or sign up.";
					} else {
						errorMessage = err.message;
					}
				} catch {
					// If parsing fails, use the original message
					errorMessage = err.message;
				}
			}

			toast({
				title: "Login failed",
				description: errorMessage,
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);
		setFormErrors({});

		// Validate passwords match
		if (password !== confirmPassword) {
			setFormErrors({ confirmPassword: "Passwords do not match" });
			setLoading(false);
			return;
		}

		const formData = {
			email,
			password,
		};

		if (!validateForm(loginSchema, formData)) {
			setLoading(false);
			return;
		}

		try {
			const res = await api.auth.signup(formData.email, formData.password);
			// Store JWT token in cookies
			if (res.token) {
				cookies.set("jwt", res.token, 7); // 7 days
			}

			// Store user info
			if (res.user) {
				cookies.set("user", JSON.stringify(res.user), 7);
				localStorage.setItem("user", JSON.stringify(res.user));
			}

			toast({
				title: "Account created successfully!",
				description: "Please complete your profile setup",
				variant: "success",
			});

			// Reset form for onboarding
			resetForm();
			setEmail(formData.email); // Keep the email for onboarding
			setIsSignup(false);
			setIsOnboarding(true);
			setStep(2); // Start onboarding at step 2 (bank account setup)
		} catch (err: unknown) {
			console.error("Signup failed", err);

			let errorMessage = "Signup failed. Please try again.";
			if (err instanceof Error && err.message) {
				errorMessage = err.message;
			}

			toast({
				title: "Signup failed",
				description: errorMessage,
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleOnboardingSubmit = async (
		e: React.FormEvent<HTMLFormElement>
	) => {
		e.preventDefault();

		// Step 1 (Personal Info) - COMMENTED OUT FOR SIMPLICITY
		/*
		if (step === 1) {
			// Validate step 1 before proceeding
			const personalData = {
				fullName,
				phone,
			};
			if (!validateForm(personalInfoSchema, personalData)) {
				return;
			}
			setStep(step + 1);
		} else if (step === 2) {
		*/
		if (step === 2) {
			// Validate step 2 and submit onboarding
			const bankData = {
				bankCode,
				bankName,
				accountNumber,
				accountName,
			};
			if (!validateForm(bankDetailsSchema, bankData)) {
				return;
			}

			// Step 2: Complete Setup - Save to MongoDB first
			try {
				// Validate bank fields are filled (name/phone skipped for simplicity)
				if (
					!bankCode ||
					!bankName ||
					!accountNumber ||
					!accountName
				) {
					toast({
						title: "Missing Information",
						description: "Please fill in all bank fields before completing setup",
						variant: "destructive",
					});
					return;
				}

				// Validate that account is verified
				if (!accountVerified) {
					toast({
						title: "Account Verification Required",
						description: "Please verify your bank account before proceeding",
						variant: "destructive",
					});
					return;
				}

				const onboardingData = {
					email,
					name: email.split('@')[0], // Use email prefix as name since we skipped name input
					phone: '', // Empty phone since we skipped phone input
					bankDetails: {
						bankCode,
						bankName,
						accountNumber,
						accountName,
					},
				};

				const token = cookies.get("jwt");
				if (!token) {
					toast({
						title: "Authentication error",
						description: "Please log in again",
						variant: "destructive",
					});
					return;
				}

				const result = await api.auth.onboarding(onboardingData, token);

				// Update stored user data with completion status
				if (result.user) {
					cookies.set("user", JSON.stringify(result.user), 7);
					localStorage.setItem("user", JSON.stringify(result.user));
				}

				toast({
					title: "Onboarding complete!",
					description: "Your account is now set up",
					variant: "success",
				});

				// Move to step 3 (wallet creation) after successful save
				setStep(3);
			} catch (err: unknown) {
				let errorMessage = "Onboarding failed. Please try again.";
				if (err instanceof Error && err.message) {
					errorMessage = err.message;
				}

				toast({
					title: "Onboarding failed",
					description: errorMessage,
					variant: "destructive",
				});
			}
		}
	};

	const getFieldError = (fieldName: string) => {
		return formErrors[fieldName] || "";
	};

	const resetForm = () => {
		setEmail("");
		setPassword("");
		setConfirmPassword("");
		setFullName("");
		setPhone("");
		setBankCode("");
		setBankName("");
		setAccountNumber("");
		setAccountName("");
		setFormErrors({});
		setStep(1);
		setAccountVerified(false);
		setVerifyingAccount(false);
		setVerificationError("");
	};

	const goBackToLogin = () => {
		setIsSignup(false);
		setIsOnboarding(false);
		resetForm();
	};

	return (
		<div className="min-h-screen bg-background">
			<Navigation landing={false}/>

			<div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
				<div className="max-w-md mx-auto">
					{!isOnboarding && !isSignup ? (
						<Card className="w-full max-w-md mx-auto">
							<CardContent className="p-4 sm:p-8">
								<div className="text-center mb-6">
									<CardTitle className="text-2xl">Welcome to SendPay</CardTitle>
									<CardDescription>Sign in to your account</CardDescription>
								</div>

								<form className="space-y-4" onSubmit={handleEmailPasswordLogin}>
									<div className="space-y-2">
										<Label htmlFor="email">Email</Label>
										<Input
											id="email"
											type="email"
											placeholder="Enter your email"
											value={email}
											onChange={(e) => {
												setEmail(e.target.value);
												clearFieldError("email");
											}}
											required
											className={getFieldError("email") ? "border-red-500" : ""}
										/>
										{getFieldError("email") && (
											<p className="text-red-500 text-xs">
												{getFieldError("email")}
											</p>
										)}
									</div>
									<div className="space-y-2">
										<Label htmlFor="password">Password</Label>
										<div className="relative">
											<Input
												id="password"
												type={showPassword ? "text" : "password"}
												placeholder="Enter your password"
												value={password}
												onChange={(e) => {
													setPassword(e.target.value);
													clearFieldError("password");
												}}
												required
												className={
													getFieldError("password")
														? "border-red-500 pr-10"
														: "pr-10"
												}
											/>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
												onClick={() => setShowPassword(!showPassword)}
											>
												{showPassword ? (
													<EyeOff className="h-4 w-4 text-gray-500" />
												) : (
													<Eye className="h-4 w-4 text-gray-500" />
												)}
											</Button>
										</div>
										{getFieldError("password") && (
											<p className="text-red-500 text-xs">
												{getFieldError("password")}
											</p>
										)}
									</div>
									<Button type="submit" className="w-full" disabled={loading}>
										{loading ? "Signing In..." : "Sign In"}
									</Button>
								</form>

								<div className="text-center text-sm mt-4">
									<span className="text-muted-foreground">
										Don&apos;t have an account?{" "}
									</span>
									<Button
										variant="link"
										className="p-0 h-auto"
										onClick={() => setIsSignup(true)}
									>
										Sign up
									</Button>
								</div>
							</CardContent>
						</Card>
					) : isSignup ? (
						<Card className="w-full max-w-md mx-auto">
							<CardContent className="p-4 sm:p-8">
								<div className="text-center mb-6 relative">
									<Button
										variant="ghost"
										size="sm"
										className="absolute left-0 top-0 z-10"
										onClick={goBackToLogin}
									>
										<ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
										<span className="hidden sm:inline">Back</span>
									</Button>
									<CardTitle className="text-2xl">Create Account</CardTitle>
									<CardDescription>
										Sign up to start using SendPay
									</CardDescription>
								</div>
								<form onSubmit={handleSignup} className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="signup-email">Email</Label>
										<Input
											id="signup-email"
											type="email"
											placeholder="Enter your email"
											value={email}
											onChange={(e) => {
												setEmail(e.target.value);
												clearFieldError("email");
											}}
											required
											className={getFieldError("email") ? "border-red-500" : ""}
										/>
										{getFieldError("email") && (
											<p className="text-red-500 text-xs">
												{getFieldError("email")}
											</p>
										)}
									</div>
									<div className="space-y-2">
										<Label htmlFor="signup-password">Password</Label>
										<div className="relative">
											<Input
												id="signup-password"
												type={showPassword ? "text" : "password"}
												placeholder="Enter your password"
												value={password}
												onChange={(e) => {
													setPassword(e.target.value);
													clearFieldError("password");
												}}
												required
												className={
													getFieldError("password")
														? "border-red-500 pr-10"
														: "pr-10"
												}
											/>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
												onClick={() => setShowPassword(!showPassword)}
											>
												{showPassword ? (
													<EyeOff className="h-4 w-4 text-gray-500" />
												) : (
													<Eye className="h-4 w-4 text-gray-500" />
												)}
											</Button>
										</div>
										{getFieldError("password") && (
											<p className="text-red-500 text-xs">
												{getFieldError("password")}
											</p>
										)}
									</div>
									<div className="space-y-2">
										<Label htmlFor="confirm-password">Confirm Password</Label>
										<div className="relative">
											<Input
												id="confirm-password"
												type={showConfirmPassword ? "text" : "password"}
												placeholder="Confirm your password"
												value={confirmPassword}
												onChange={(e) => {
													setConfirmPassword(e.target.value);
													clearFieldError("confirmPassword");
												}}
												required
												className={
													getFieldError("confirmPassword")
														? "border-red-500 pr-10"
														: "pr-10"
												}
											/>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
												onClick={() =>
													setShowConfirmPassword(!showConfirmPassword)
												}
											>
												{showConfirmPassword ? (
													<EyeOff className="h-4 w-4 text-gray-500" />
												) : (
													<Eye className="h-4 w-4 text-gray-500" />
												)}
											</Button>
										</div>
										{getFieldError("confirmPassword") && (
											<p className="text-red-500 text-xs">
												{getFieldError("confirmPassword")}
											</p>
										)}
									</div>
									<Button type="submit" className="w-full" disabled={loading}>
										{loading ? "Creating Account..." : "Create Account"}
									</Button>
								</form>
							</CardContent>
						</Card>
					) : (
						<Card className="w-full max-w-md mx-auto">
							<CardContent className="p-4 sm:p-8">
								<div className="text-center mb-6 relative">
									<Button
										variant="ghost"
										size="sm"
										className="absolute left-0 top-0 z-10"
										onClick={goBackToLogin}
									>
										<ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
										<span className="hidden  sr-only">Back</span>
									</Button>
									<CardTitle className="text-xl sm:text-2xl">
										Complete Your Profile
									</CardTitle>
									
									
									{/* Stepper */}
									<div className="flex items-center justify-center space-x-2 md:space-x-4 mt-4">
										{/* Step 1 - Bank Setup */}
										<div className="flex items-center">
											<div className={`md:w-6 md:h-6 h-5 w-5 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
												step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
											}`}>
												1
											</div>
											<span className={`ml-1 sm:ml-2 text-xs sm:text-sm ${
												step >= 2 ? 'text-blue-600 font-medium' : 'text-gray-500'
											}`}>
												Bank Account
											</span>
										</div>
										
										{/* Connector */}
										<div className={`w-8 h-0.5 ${
											step >= 3 ? 'bg-blue-600' : 'bg-gray-200'
										}`}></div>
										
										{/* Step 2 - Wallet Creation */}
										<div className="flex items-center">
											<div className={`md:w-6 md:h-6 h-5 w-5 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
												step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
											}`}>
												2
											</div>
											<span className={`ml-1 sm:ml-2 text-xs sm:text-sm ${
												step >= 3 ? 'text-blue-600 font-medium' : 'text-gray-500'
											}`}>
												Create Wallet
											</span>
										</div>
									</div>
								</div>
								<form onSubmit={handleOnboardingSubmit} className="space-y-4">
									{/* Step 1 - Personal Info (COMMENTED OUT FOR SIMPLICITY) */}
									{/* 
									{step === 1 && (
										<>
											<div className="space-y-2">
												<Label htmlFor="fullName">Full Name</Label>
												<Input
													id="fullName"
													placeholder="Enter your full name"
													value={fullName}
													onChange={(e) => {
														setFullName(e.target.value);
														clearFieldError("fullName");
													}}
													required
													className={
														getFieldError("fullName") ? "border-red-500" : ""
													}
												/>
												{getFieldError("fullName") && (
													<p className="text-red-500 text-xs">
														{getFieldError("fullName")}
													</p>
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
														setPhone(e.target.value);
														clearFieldError("phone");
													}}
													required
													className={
														getFieldError("phone") ? "border-red-500" : ""
													}
												/>
												{getFieldError("phone") && (
													<p className="text-red-500 text-xs">
														{getFieldError("phone")}
													</p>
												)}
											</div>
										</>
									)}
									*/}

									{step === 2 && (
										<>
											<div className="space-y-2">
												<Label htmlFor="bankCode">Bank</Label>
												
											{banks.length === 0 ? (
												<div className="flex items-center justify-center py-4 border rounded-md">
													<span className="text-muted-foreground">No banks available</span>
															</div>
											) : (
												<Combobox
													options={bankOptions}
													value={bankCode}
													onValueChange={handleBankSelection}
													placeholder="Select your bank"
													searchPlaceholder="Search banks..."
													emptyMessage="No banks found."
													className={getFieldError("bankCode") ? "border-red-500" : ""}
												/>
											)}
												{getFieldError("bankCode") && (
													<p className="text-red-500 text-xs">
														{getFieldError("bankCode")}
													</p>
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
														const value = e.target.value.replace(/[^0-9]/g, "");
														setAccountNumber(value);
														clearFieldError("accountNumber");
														// Reset verification when account number changes
														setAccountVerified(false);
														setVerificationError("");
														// Trigger debounced verification when 10 digits are entered
														if (value.length === 10 && bankCode) {
															debouncedVerifyAccount(value, bankCode);
														}
													}}
													required
													className={
														getFieldError("accountNumber")
															? "border-red-500"
															: ""
													}
													onKeyPress={(e) => {
														if (!/[0-9]/.test(e.key)) {
															e.preventDefault();
														}
													}}
												/>
												{getFieldError("accountNumber") && (
													<p className="text-red-500 text-xs">
														{getFieldError("accountNumber")}
													</p>
												)}
												<p className="text-xs text-muted-foreground">
													Nigerian bank account numbers are exactly 10 digits
												</p>
											</div>
											<div className="space-y-2">
												<Label htmlFor="accountName">Account Name</Label>
												<div className="relative">
													<div
														className={`w-full px-3 h-10 py-2 border rounded-md text-sm ${
															verifyingAccount 
																? "border-blue-500 text-blue-700" 
																: verificationError
																	? "border-red-500 text-red-700"
																: accountVerified 
																	? "border-green-500 text-green-700" 
																	: "border-gray-300 text-gray-500"
														}`}
													>
														{verifyingAccount 
															? "Verifying..." 
															: verificationError
																? verificationError
															: accountVerified 
																? accountName 
																: ""}
													</div>
													{verifyingAccount && (
														<div className="absolute right-3 top-1/2 transform -translate-y-1/2">
															<Loader2 className="h-4 w-4 animate-spin text-blue-500" />
														</div>
													)}
													{accountVerified && (
														<div className="absolute right-3 top-1/2 transform -translate-y-1/2">
															<svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
															</svg>
														</div>
													)}
												</div>
											</div>
										</>
									)}

                                    {step === 3 && (
                                        <div className="text-center space-y-6">
                                            {!walletCreated ? (
                                                <>
                                                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                                                        <svg
                                                            className="w-8 h-8 text-blue-600"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                                            />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-semibold">
                                                            Create Your Wallet
                                                        </h3>
                                                        <p className="text-muted-foreground">
                                                            Set up a secure wallet to complete your SendPay account
                                                        </p>
                                                    </div>
                                                    <Button 
                                                        onClick={() => setShowCreateWallet(true)}
                                                        className="w-full"
                                                    >
                                                        Create Wallet
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                                        <svg
                                                            className="w-8 h-8 text-green-600"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M5 13l4 4L19 7"
                                                            />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-semibold">Setup Complete!</h3>
                                                        <p className="text-muted-foreground">Your SendPay account is ready to use</p>
                                                    </div>
                                                    <Button 
                                                        onClick={() => router.push("/dashboard")}
                                                        className="w-full"
                                                    >
                                                        Go to Dashboard
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    )}

									{step === 2 && (
										<div className="space-y-2">
											<Button 
												type="submit" 
												className="w-full"
												disabled={!accountVerified || verifyingAccount}
											>
												{verifyingAccount ? "Verifying Account..." : 
												 accountVerified ? "Complete Setup" : 
												 "Verify Account First"}
											</Button>
										</div>
									)}
								</form>
							</CardContent>
						</Card>
					)}
				</div>
			</div>

			{/* Wallet Creation Modal */}
			<CreatePinModal 
				open={showCreateWallet} 
				onClose={() => setShowCreateWallet(false)}
				onSuccess={() => {
					setWalletCreated(true);
					setShowCreateWallet(false);
				}}
			/>
		</div>
	);
}
