"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { Moon, Sun, Menu, X } from "lucide-react";
import { SiZebpay } from "react-icons/si";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

interface Navigation {
	landing: boolean;
}

export default function Navigation({ landing }: Navigation) {
	const [mounted, setMounted] = useState(false);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const { theme, setTheme } = useTheme();
	const router = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		setMounted(true);
	}, []);

	const toggleTheme = () => {
		setTheme(theme === "light" ? "dark" : "light");
	};

	const isActive = (path: string) => {
		return pathname === path;
	};

	const navItems = [
		{ href: "/dashboard", label: "Dashboard" },
		{ href: "/receive", label: "Receive" },
		{ href: "/withdraw", label: "Withdraw" },
		{ href: "/history", label: "History" },
	];

	if (!mounted) {
		return null;
	}

	const landingStyle = landing
		? " z-20 md:w-[80%] absolute left-[50%] -translate-x-[50%]  rounded-3xl top-10 "
		: "";

	return (
		<nav
			className={`border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60  ${landingStyle}`}
		>
			<div className="container mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex h-16 items-center justify-between">
					{/* Logo */}
					<div className="flex items-center space-x-2 min-w-0 flex-shrink-0">
						<Link
							href="/"
							className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
						>
							<SiZebpay className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
							<span className="text-lg sm:text-xl font-bold truncate">
								SendPay
							</span>
						</Link>
					</div>

					{/* Desktop Navigation */}
					<div className="hidden md:flex items-center space-x-6 flex-shrink-0">
						{navItems.map((item) => (
							<Link
								key={item.href}
								href={item.href}
								className={`text-sm font-medium transition-colors hover:text-primary whitespace-nowrap ${
									isActive(item.href) ? "text-primary" : "text-muted-foreground"
								}`}
							>
								{item.label}
							</Link>
						))}
					</div>

					{/* Right side - Theme toggle and mobile menu */}
					<div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
						{/* Theme Toggle */}
						<Button
							variant="ghost"
							size="sm"
							onClick={toggleTheme}
							className="h-8 w-8 sm:h-9 sm:w-9 px-0"
						>
							<Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
							<Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
							<span className="sr-only">Toggle theme</span>
						</Button>

						{/* Mobile menu button */}
						<Button
							variant="ghost"
							size="sm"
							className="md:hidden h-8 w-8 px-0"
							onClick={() => setIsMenuOpen(!isMenuOpen)}
						>
							{isMenuOpen ? (
								<X className="h-4 w-4" />
							) : (
								<Menu className="h-4 w-4" />
							)}
							<span className="sr-only">Toggle menu</span>
						</Button>
					</div>
				</div>

				{/* Mobile Navigation */}
				{isMenuOpen && (
					<div className="md:hidden border-t">
						<div className="py-4 space-y-2">
							{navItems.map((item) => (
								<Link
									key={item.href}
									href={item.href}
									className={`block px-4 py-2 text-sm font-medium rounded-md transition-colors ${
										isActive(item.href)
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
									}`}
									onClick={() => setIsMenuOpen(false)}
								>
									{item.label}
								</Link>
							))}
						</div>
					</div>
				)}
			</div>
		</nav>
	);
}
