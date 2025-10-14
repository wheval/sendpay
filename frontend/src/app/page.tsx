"use client";

import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ArrowRight, Shield, Zap, Globe, Smartphone } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { LogoIcon } from "@/icons/logo-icon";

export default function HomePage() {
	const { theme } = useTheme();
	
	return (
		<div className="bg-background flex flex-col">
			{/* Hero Section */}
			<section className="relative min-h-screen bg-background">
				<Navigation landing />
				<div className="relative md:top-20 left-0 py-20 px-4 sm:px-6 lg:px-8 h-full w-full">
					<div className="sm:container mx-auto text-center">
						<h1 className="text-4xl sm:text-5xl lg:text-8xl font-light tracking-tight mb-6">
							Crypto in. Cash out
							{/* ↔ */}
							<span className="text-primary block">Instantly</span> For Africa
						</h1>
						<p className="text-lg: sm:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
							Swap and cash out fast. Secure payouts straight to your local bank.
							Cross-border Remitances, Enjoy the power of Starknet/Bitcoin, No fees, No ID, No hassle.
						</p>
						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<Button asChild size="lg" className="text-lg px-8 py-6">
								<Link href="/login">
									Get Started
									<ArrowRight className="ml-2 h-5 w-5" />
								</Link>
							</Button>
							{/* <Button variant="outline" size="lg" className="text-lg px-8 py-6">
								<Link href="/receive">Receive Money</Link>
							</Button> */}
						</div>
						<p className="text-muted-foreground text-sm mt-8 max-w-3xl mx-auto">
							*Available in Nigeria today.
						</p>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section className="py-20 px-4 sm:px-6 lg:px-8 bg-accent">
				<div className="container mx-auto">
					<div className="text-center mb-16">
						<h2 className="text-3xl sm:text-4xl font-bold mb-4 text-accent-foreground">
							Why Choose SendPay?
						</h2>
						<p className="text-lg text-accent-foreground/80 max-w-2xl mx-auto">
							Experience the future of money transfers with our cutting-edge
							platform
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
						<Card className="text-center bg-background/95 backdrop-blur">
							<CardHeader>
								<div className="mx-auto w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mb-4">
									<Zap className="h-6 w-6 text-accent" />
								</div>
								<CardTitle className="text-card-foreground">Lightning Fast</CardTitle>
							</CardHeader>
							<CardContent>
								<CardDescription className="text-card-foreground/70">
									Send money in seconds, not days. Instant transfers worldwide.
								</CardDescription>
							</CardContent>
						</Card>

						<Card className="text-center bg-background/95 backdrop-blur">
							<CardHeader>
								<div className="mx-auto w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mb-4">
									<Shield className="h-6 w-6 text-accent" />
								</div>
								<CardTitle className="text-card-foreground">Bank-Level Security</CardTitle>
							</CardHeader>
							<CardContent>
								<CardDescription className="text-card-foreground/70">
									Your money is protected with enterprise-grade security
									measures.
								</CardDescription>
							</CardContent>
						</Card>

						<Card className="text-center bg-background/95 backdrop-blur">
							<CardHeader>
								<div className="mx-auto w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mb-4">
									<Globe className="h-6 w-6 text-accent" />
								</div>
								<CardTitle className="text-card-foreground">Global Reach</CardTitle>
							</CardHeader>
							<CardContent>
								<CardDescription className="text-card-foreground/70">
									Send money to over 200 countries and territories worldwide.
								</CardDescription>
							</CardContent>
						</Card>

						<Card className="text-center bg-background/95 backdrop-blur">
							<CardHeader>
								<div className="mx-auto w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mb-4">
									<Smartphone className="h-6 w-6 text-accent" />
								</div>
								<CardTitle className="text-card-foreground">Mobile First</CardTitle>
							</CardHeader>
							<CardContent>
								<CardDescription className="text-card-foreground/70">
									Manage your money on the go with our mobile-optimized
									platform.
								</CardDescription>
							</CardContent>
						</Card>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t bg-card py-12 px-4 sm:px-6 lg:px-8">
				<div className="container mx-auto text-center">
					<div className="flex items-center justify-center space-x-2 mb-4">
						<LogoIcon color={theme === "light" ? "#6939FD" : "#F9F9F9"} />
						<span className="text-xl font-bold text-card-foreground">SendPay</span>
					</div>
					<p className="text-card-foreground/70">
						<span suppressHydrationWarning>
							© {typeof window !== "undefined" ? new Date().getFullYear() : ""} SendPay. All rights reserved.
						</span>
					</p>
				</div>
			</footer>
		</div>
	);
}