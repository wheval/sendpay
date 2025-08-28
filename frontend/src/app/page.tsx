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
import { SiZebpay } from "react-icons/si";
import Link from "next/link";
import Silk from "@/components/SilkBg";

export default function HomePage() {
	return (
		<div className="bg-background flex flex-col">
			{/* Hero Section */}
			<section className="relative min-h-screen">
				<Navigation landing />
				<div className="absolute h-full w-full top-0 left-0 dark:opacity-40 opacity-30 dark:blur-sm blur-0">
					<Silk color="#FFFFFF" />
					{/* <p>Hello world</p> */}
				</div>

				<div className="relative z-10 top-40 left-0 py-20 px-4 sm:px-6 lg:px-8 h-full w-full">
					<div className="container mx-auto text-center">
						<h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
							STRK/USDC to NAIRA
							<span className="text-primary block">in minutes</span>
						</h1>
						<p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
							Swap and cash out fast. Secure payouts straight to your Nigerian bank.
						</p>
						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<Button asChild size="lg" className="text-lg px-8 py-6">
								<Link href="/login">
									Get Started
									<ArrowRight className="ml-2 h-5 w-5" />
								</Link>
							</Button>
							<Button variant="outline" size="lg" className="text-lg px-8 py-6">
								<Link href="/receive">Receive Money</Link>
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
				<div className="container mx-auto">
					<div className="text-center mb-16">
						<h2 className="text-3xl sm:text-4xl font-bold mb-4">
							Why Choose SendPay?
						</h2>
						<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
							Experience the future of money transfers with our cutting-edge
							platform
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
						<Card className="text-center">
							<CardHeader>
								<div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
									<Zap className="h-6 w-6 text-primary" />
								</div>
								<CardTitle>Lightning Fast</CardTitle>
							</CardHeader>
							<CardContent>
								<CardDescription>
									Send money in seconds, not days. Instant transfers worldwide.
								</CardDescription>
							</CardContent>
						</Card>

						<Card className="text-center">
							<CardHeader>
								<div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
									<Shield className="h-6 w-6 text-primary" />
								</div>
								<CardTitle>Bank-Level Security</CardTitle>
							</CardHeader>
							<CardContent>
								<CardDescription>
									Your money is protected with enterprise-grade security
									measures.
								</CardDescription>
							</CardContent>
						</Card>

						<Card className="text-center">
							<CardHeader>
								<div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
									<Globe className="h-6 w-6 text-primary" />
								</div>
								<CardTitle>Global Reach</CardTitle>
							</CardHeader>
							<CardContent>
								<CardDescription>
									Send money to over 200 countries and territories worldwide.
								</CardDescription>
							</CardContent>
						</Card>

						<Card className="text-center">
							<CardHeader>
								<div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
									<Smartphone className="h-6 w-6 text-primary" />
								</div>
								<CardTitle>Mobile First</CardTitle>
							</CardHeader>
							<CardContent>
								<CardDescription>
									Manage your money on the go with our mobile-optimized
									platform.
								</CardDescription>
							</CardContent>
						</Card>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
				<div className="container mx-auto text-center">
					<div className="flex items-center justify-center space-x-2 mb-4">
						<SiZebpay className="h-8 w-8 text-primary" />
						<span className="text-xl font-bold">SendPay</span>
					</div>
					<p className="text-muted-foreground">
						© 2024 SendPay. All rights reserved.
					</p>
				</div>
			</footer>
		</div>
	);
}