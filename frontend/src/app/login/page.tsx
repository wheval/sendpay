"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	ArrowLeft,
	Mail,
	Lock,
	User,
	CreditCard,
	Building2,
	Eye,
	EyeOff,
	Loader2,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import Navigation from "@/components/navigation";
import { z } from "zod";
import {
	loginSchema,
	personalInfoSchema,
	bankDetailsSchema,
	type LoginFormData,
	type PersonalInfoData,
	type BankDetailsData,
} from "@/lib/schemas";
import { useToast } from "@/hooks/use-toast";
import { cookies } from "@/lib/cookies";
import { normalizeHex } from "@/lib/utils";

interface Bank {
  id: number;
  code: string;
  name: string;
  country: string;
  currency: string;
  type: string;
  active: boolean;
}

export default function LoginPage() {
	const [isOnboarding, setIsOnboarding] = useState(false);
	const [isSignup, setIsSignup] = useState(false);
	const [step, setStep] = useState(1);
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

	// Banks state
	const [banks, setBanks] = useState<Bank[]>([]);
	const [banksLoading, setBanksLoading] = useState(false);

	const { toast } = useToast();
	const router = useRouter();

	// Fetch banks from Flutterwave API
	useEffect(() => {
		const fetchBanks = async () => {
			if (step === 2 && banks.length === 0) {
				setBanksLoading(true);
				try {
					const response = await api.flutterwave.banks();
					if (response.success && response.data) {
						setBanks(response.data);
					}
				} catch (error) {
					console.error('Failed to fetch banks:', error);
					toast({
						title: "Error",
						description: "Failed to load banks. Please try again.",
						variant: "destructive",
					});
				} finally {
					setBanksLoading(false);
				}
			}
		};

		fetchBanks();
	}, [step, banks.length, toast]);

	// Handle bank selection
	const handleBankSelection = (selectedBankCode: string) => {
		setBankCode(selectedBankCode);
		const selectedBank = banks.find(bank => bank.code === selectedBankCode);
		if (selectedBank) {
			setBankName(selectedBank.name);
		}
		clearFieldError("bankCode");
	};

	const validateForm = (schema: z.ZodSchema, data: any) => {
		try {
			schema.parse(data);
			setFormErrors({});
			return true;
		} catch (err) {
			if (err instanceof z.ZodError) {
				const errors: Record<string, string> = {};
				err.issues.forEach((issue: any) => {
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

			// Check if user needs onboarding
			if (res.user && !res.user.hasBankDetails) {
				// Reset form for onboarding
				resetForm();
				setEmail(formData.email); // Keep the email for onboarding
				setIsOnboarding(true);
			} else {
				// Redirect to dashboard if onboarding is complete
				router.push("/dashboard");
			}
		} catch (err: any) {
			console.error("Login failed", err);

			// Parse error message for user-friendly display
			let errorMessage = "Login failed. Please check your credentials.";

			if (err.message) {
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
		} catch (err: any) {
			console.error("Signup failed", err);

			let errorMessage = "Signup failed. Please try again.";
			if (err.message) {
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
				// Validate all fields are filled
				if (
					!fullName ||
					!phone ||
					!bankCode ||
					!bankName ||
					!accountNumber ||
					!accountName
				) {
					toast({
						title: "Missing Information",
						description: "Please fill in all fields before completing setup",
						variant: "destructive",
					});
					return;
				}

				const onboardingData = {
					email,
					name: fullName,
					phone,
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

				toast({
					title: "Onboarding complete!",
					description: "Your account is now set up",
					variant: "success",
				});

				// Only move to step 3 after successful save
				setStep(3);

				// Redirect to dashboard immediately
				router.push("/dashboard");
			} catch (err: any) {
				let errorMessage = "Onboarding failed. Please try again.";
				if (err.message) {
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
	};

	const clearFieldError = (fieldName: string) => {
		if (formErrors[fieldName]) {
			setFormErrors((prev) => {
				const newErrors = { ...prev };
				delete newErrors[fieldName];
				return newErrors;
			});
		}
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
							<CardContent className="p-6 sm:p-8">
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
							<CardContent className="p-6 sm:p-8">
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
							<CardContent className="p-6 sm:p-8">
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
									<CardTitle className="text-xl sm:text-2xl">
										Complete Your Profile
									</CardTitle>
									<CardDescription className="text-sm sm:text-base">
										Step {step} of 3:{" "}
										{step === 1
											? "Personal Info"
											: step === 2
											? "Bank Details"
											: "Verification"}
									</CardDescription>
								</div>
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

									{step === 2 && (
										<>
											<div className="space-y-2">
												<Label htmlFor="bankCode">Bank</Label>
												<Select
													value={bankCode}
													onValueChange={handleBankSelection}
													required
												>
													<SelectTrigger
														className={
															getFieldError("bankCode") ? "border-red-500" : ""
														}
													>
														<SelectValue placeholder="Select your bank" />
													</SelectTrigger>
													<SelectContent>
														{banksLoading ? (
															<div className="flex items-center justify-center py-4">
																<Loader2 className="h-6 w-6 animate-spin text-primary" />
															</div>
														) : banks.length === 0 ? (
															<SelectItem value="" disabled>
																No banks found. Please try again later.
															</SelectItem>
														) : (
															banks.map((bank) => (
																<SelectItem key={bank.id} value={bank.code}>
																	{bank.name}
																</SelectItem>
															))
														)}
													</SelectContent>
												</Select>
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
												<Input
													id="accountName"
													placeholder="Enter your account name"
													value={accountName}
													onChange={(e) => {
														setAccountName(e.target.value);
														clearFieldError("accountName");
													}}
													required
													className={
														getFieldError("accountName") ? "border-red-500" : ""
													}
												/>
												{getFieldError("accountName") && (
													<p className="text-red-500 text-xs">
														{getFieldError("accountName")}
													</p>
												)}
											</div>
										</>
									)}

									{step === 3 && (
										<div className="text-center space-y-4">
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
												<h3 className="text-lg font-semibold">
													Profile Complete!
												</h3>
												<p className="text-muted-foreground">
													Saving your information and redirecting to
													dashboard...
												</p>
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
	);
}
