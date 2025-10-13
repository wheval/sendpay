"use client";

import { useEffect, useState } from "react";
import Navigation from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Wallet, DollarSign, TrendingUp, History } from "lucide-react";
import { cookies } from "@/lib/cookies";
import { getTokenConfig, type TokenSymbol } from "@/lib/constants";
import { normalizeHex } from "@/lib/utils";
import { CreatePinModal } from "@/components/CreatePinModal";
import { WithdrawalModal } from "@/components/WithdrawalModal";
import { FundCryptoModal } from "@/components/FundCryptoModal";
import { TransferCryptoModal } from "@/components/TransferCryptoModal";
// Using backend balance service for reliability

interface UserData {
  id: string;

  email: string;

  name: string;

  chipiWalletAddress?: string;

  balanceUSD: number;

  balanceNGN: number;

  hasBankDetails?: boolean;

  bankDetails?: {
    bankName?: string;
    bankCode?: string;
    accountNumber?: string;
    accountName?: string;
  };
}

export default function DashboardPage() {
  const [userData, setUserData] = useState<UserData | null>(null);

  const [balance, setBalance] = useState<string | null>(null); // USDT

  const [strkBalance, setStrkBalance] = useState<string | null>(null);

  const [fxRate, setFxRate] = useState<number | null>(null); // USD->NGN

  const [strkUsd, setStrkUsd] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);

  const [dataLoading, setDataLoading] = useState(false); // For balances and rates

  const [error, setError] = useState("");

  const [showNGN, setShowNGN] = useState(true); // Default to NGN view

  const [showFundModal, setShowFundModal] = useState(false);

  const [showCreateWallet, setShowCreateWallet] = useState(false);

  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);

  const [showTransferModal, setShowTransferModal] = useState(false);

  const [bankAccounts, setBankAccounts] = useState<
    Array<{
    _id: string;

    bankName: string;

    accountNumber: string;

    accountName: string;
    }>
  >([]);

  const [pin, setPin] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);

  const router = useRouter();

  // Removed automatic wallet creation modal - now handled in onboarding

  useEffect(() => {
    const checkAuth = async () => {
      const token = cookies.get("jwt");

      if (!token) {
        router.push("/login");

        return;
      }

      try {
        // Set loading to false immediately after getting user data

        const userRes = await api.user.profile(token);

        const freshUser = userRes.user || userRes.data || null;
        
        if (freshUser) {
          setUserData(freshUser);
          localStorage.setItem("user", JSON.stringify(freshUser));
          setProfileLoaded(true);
          setBalance(freshUser.balanceUSD?.toString() || "0");


          setLoading(false);

          // Fetch balances and rates in parallel (non-blocking)

          const activeWallet = freshUser.chipiWalletAddress;
          
          if (activeWallet) {
            // Set data loading state

            setDataLoading(true);
            
            
            Promise.allSettled([
              // FX rate
              (async () => {
                try {
                  const summaryRes = await api.transaction.summary(token);
                  const rate =
                    summaryRes.data?.exchangeRate ||
                    summaryRes.exchangeRate ||
                    0;
                  setFxRate(Number(rate) || 0);
                } catch (error) {
                  setFxRate(null);
                }
              })(),
            ]).then(() => {
              setDataLoading(false);
            });
          }
          
          return;
        }
        
        // If response shape unexpected, fall through to cached user

        throw new Error("Invalid profile response");
      } catch {
        // Fallback to cached user (cookie or localStorage)

        const cookieUser = cookies.get("user");

        const userStr = cookieUser || localStorage.getItem("user");

        if (userStr) {
          try {
            const cachedUser = JSON.parse(userStr);

            setUserData(cachedUser);
          } catch {
            // ignore parse errors
          }
        }

        if (!userStr) {
          setError("Failed to load user data");
        }

        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Live balances using Chipi callAnyContract (preferred) with starknet.js fallback
  const activeWallet = userData?.chipiWalletAddress || "";
  const normalizedActiveWallet = activeWallet ? normalizeHex(activeWallet) : "";
  const usdcCfg = getTokenConfig("USDC") as { address: string; decimals: string };
  const strkCfg = getTokenConfig("STRK") as { address: string; decimals: string };
  // Backend service will compute balances; no on-chain reads here

  useEffect(() => {
    (async () => {
      if (!normalizedActiveWallet) return;
      const token = cookies.get("jwt");
      if (!token) return;
      
      // Set loading state
      setDataLoading(true);
      
      try {
        const usdcRes = await api.chipipay.balance(
          normalizedActiveWallet,
          usdcCfg.address,
          token
        );
        const usdcFormatted = usdcRes?.data?.formatted;
        setBalance(usdcFormatted && !isNaN(Number(usdcFormatted)) ? String(usdcFormatted) : "0");
      } catch {
        setBalance("0");
      }
      try {
        const strkRes = await api.chipipay.balance(
          normalizedActiveWallet,
          'STRK', // Use 'STRK' identifier for native token
          token
        );
        const strkFormatted = strkRes?.data?.formatted;
        setStrkBalance(strkFormatted && !isNaN(Number(strkFormatted)) ? String(strkFormatted) : "0");
      } catch {
        setStrkBalance("0");
      }
      
      // Clear loading state
      setDataLoading(false);
    })();
  }, [normalizedActiveWallet, usdcCfg.address, strkCfg.address]);

  // Short polling for balances (every 10s)
  useEffect(() => {
    if (!normalizedActiveWallet) return;
    const token = cookies.get("jwt");
    if (!token) return;

    const interval = setInterval(async () => {
      try {
        const usdcRes = await api.chipipay.balance(
          normalizedActiveWallet,
          usdcCfg.address,
          token
        );
        const usdcFormatted = usdcRes?.data?.formatted;
        if (usdcFormatted !== undefined && !isNaN(Number(usdcFormatted))) {
          setBalance(String(usdcFormatted));
        }
      } catch {}

      try {
        const strkRes = await api.chipipay.balance(
          normalizedActiveWallet,
          'STRK', // Use 'STRK' identifier for native token
          token
        );
        const strkFormatted = strkRes?.data?.formatted;
        if (strkFormatted !== undefined && !isNaN(Number(strkFormatted))) {
          setStrkBalance(String(strkFormatted));
        }
      } catch {}
    }, 10000);

    return () => clearInterval(interval);
  }, [normalizedActiveWallet, usdcCfg.address, strkCfg.address]);

  // STRK price and FX rate from backend summary
  useEffect(() => {
    (async () => {
      const token = cookies.get("jwt");
      if (!token) return;
      try {
        const summaryRes = await api.transaction.summary(token);
        const rate = summaryRes.data?.exchangeRate || summaryRes.exchangeRate;
        const strkPrice = summaryRes.data?.prices?.STRK_USD || summaryRes.prices?.STRK_USD;
        if (rate !== undefined && !isNaN(Number(rate))) setFxRate(Number(rate));
        if (strkPrice !== undefined && !isNaN(Number(strkPrice))) setStrkUsd(Number(strkPrice));
      } catch {}
    })();
  }, []);

  const handleLogout = () => {
    localStorage.clear();

    // Remove all auth-related cookies

    cookies.removeMultiple([
      "jwt",

      "accessToken",

      "refreshToken",

      "walletAddress",

      "user",
    ]);

    // Clear all state immediately

    setUserData(null);

    setBalance(null);

    setStrkBalance(null);

    setFxRate(null);

    setStrkUsd(null);

    setLoading(true);

    setDataLoading(false);

    setError("");

    setShowFundModal(false);

    setShowCreateWallet(false);

    setPin("");

    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation landing={false} />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="mb-6">
            <div className="h-8 w-40 bg-muted rounded animate-pulse" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />

                  <div className="h-6 w-6 bg-muted rounded-full animate-pulse" />
                </div>

                <div className="h-7 w-24 bg-muted rounded mb-2 animate-pulse" />

                <div className="h-3 w-32 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border rounded-lg p-6">
              <div className="h-5 w-32 bg-muted rounded mb-4 animate-pulse" />

              <div className="space-y-3">
                <div className="h-10 w-full bg-muted rounded animate-pulse" />

                <div className="h-10 w-full bg-muted rounded animate-pulse" />

                <div className="h-10 w-full bg-muted rounded animate-pulse" />
              </div>
            </div>

            <div className="border rounded-lg p-6">
              <div className="h-5 w-40 bg-muted rounded mb-4 animate-pulse" />

              <div className="space-y-3">
                <div className="h-4 w-48 bg-muted rounded animate-pulse" />

                <div className="h-4 w-56 bg-muted rounded animate-pulse" />

                <div className="h-4 w-64 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
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
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No user data found</p>

          <Button onClick={() => router.push("/login")} className="mt-4">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  const displayWallet = normalizeHex(userData.chipiWalletAddress || "");
  
  // Check if wallet address is actually valid

  const hasValidWallet =
    displayWallet &&
    displayWallet.length >= 42 &&
    displayWallet.startsWith("0x");
  
  const finalDisplayWallet = hasValidWallet
    ? displayWallet
    : "Wallet Address unavailable";

  const hasChipiWallet = !!userData?.chipiWalletAddress;

  // Compute onboarding status using either backend flag or explicit fields
  const hasBankComplete =
    Boolean(userData?.hasBankDetails) ||
    (Boolean(userData?.bankDetails?.bankName) &&
      Boolean(userData?.bankDetails?.bankCode) &&
      Boolean(userData?.bankDetails?.accountNumber) &&
      Boolean(userData?.bankDetails?.accountName));
  const needsOnboarding = !userData?.chipiWalletAddress || !hasBankComplete;

  return (
    <div className="min-h-screen bg-background">
      <Navigation landing={false} />
      
      {/* Onboarding Completion Banner */}

      {!loading && profileLoaded && needsOnboarding && (
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row gap-y-2 lg:items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-orange-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>

                <div className="ml-3">
                  <p className="text-sm text-orange-700">
                    <strong>Complete your profile</strong> to unlock all SendPay
                    features and start receiving payments.
                  </p>
                </div>
              </div>

              <div className="flex-shrink-0">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => router.push("/login?onboarding=true")}
                  className="text-orange-700 border-orange-300 hover:bg-orange-100"
                >
                  Complete Profile
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-xl mb-2 md:text-3xl capitalize font-bold">
              Welcome, {userData.name}.
            </h1>

            {!hasChipiWallet && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Wallet not configured</span>
              </div>
            )}

            {hasChipiWallet && !dataLoading && (!balance || !strkBalance) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Some data failed to load</span>

                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="h-6 px-2 text-xs"
                >
                  Retry
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Currency:</span>

              <Button 
                variant={showNGN ? "default" : "outline"} 
                size="sm"
                onClick={() => setShowNGN(true)}
              >
                NGN
              </Button>

              <Button 
                variant={!showNGN ? "default" : "outline"} 
                size="sm"
                onClick={() => setShowNGN(false)}
              >
                USD
              </Button>
            </div>

            {fxRate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rate: 1$ = ₦{fxRate.toLocaleString()}</span>
              </div>
            )}

            <Button
              variant="outline"
              onClick={handleLogout}
              className="hidden md:inline-flex"
            >
              Logout
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Balance ({showNGN ? "NGN" : "USD"})
              </CardTitle>

              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>

            <CardContent>
              {dataLoading ? (
                <div className="space-y-2">
                  <div className="h-8 w-32 bg-muted rounded animate-pulse" />

                  <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                </div>
              ) : (
                (() => {
                  // Show loading if balances are not loaded yet
                  if (balance === null || strkBalance === null) {
                    return (
                      <div className="transition-all duration-500 ease-out opacity-100">
                        <div className="text-3xl font-bold text-muted-foreground">
                          Loading...
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Fetching balance data
                        </p>
                      </div>
                    );
                  }

                  const usdtNum = Number(balance || "0");
                  const strkNum = Number(strkBalance || "0");
                  const totalUsd = usdtNum + strkNum * (strkUsd || 0);
                  const totalNgn = totalUsd * (fxRate || 0);

                  return (
                    <div className="transition-all duration-500 ease-out opacity-100">
                      <div className="text-3xl font-bold">
                        {showNGN
                          ? `₦${totalNgn.toLocaleString()}`
                          : `$${totalUsd.toFixed(2)}`}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        ≈{" "}
                        {showNGN
                          ? `$${totalUsd.toFixed(2)} USD`
                          : `₦${totalNgn.toLocaleString()} NGN`}
                      </p>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                USDC Balance
              </CardTitle>

              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>

            <CardContent>
              {dataLoading ? (
                <div className="space-y-2">
                  <div className="h-6 w-24 bg-muted rounded animate-pulse" />

                  <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                </div>
              ) : (
                (() => {
                  // Show loading if balance is not loaded yet
                  if (balance === null) {
                    return (
                      <div className="transition-all duration-500 ease-out opacity-100">
                        <div className="text-xl font-bold text-muted-foreground">
                          Loading...
                        </div>
                      </div>
                    );
                  }

                  const usdcNum = Number(balance || "0");
                  const usdcUsd = usdcNum; // 1 USDC = 1 USD
                  const usdcNgn = usdcUsd * (fxRate || 0);

                  return (
                    <div className="transition-all duration-500 ease-out opacity-100">
                      <div className="text-2xl font-bold">
                        {showNGN
                          ? `₦${usdcNgn.toLocaleString()}`
                          : `${usdcNum.toFixed(2)} USDC`}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {showNGN
                          ? `≈ ${usdcNum.toFixed(2)} USDC ($${usdcUsd.toFixed(2)})`
                          : `≈ ₦${usdcNgn.toLocaleString()} NGN`}
                      </p>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                STRK Balance
              </CardTitle>

              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>

            <CardContent>
              {dataLoading ? (
                <div className="space-y-2">
                  <div className="h-6 w-24 bg-muted rounded animate-pulse" />

                  <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                </div>
              ) : (
                (() => {
                  // Show loading if balance is not loaded yet
                  if (strkBalance === null) {
                    return (
                      <div className="transition-all duration-500 ease-out opacity-100">
                        <div className="text-xl font-bold text-muted-foreground">
                          Loading...
                        </div>
                      </div>
                    );
                  }

                  const strkNum = Number(strkBalance || "0");
                  const strkUsdValue = strkNum * (strkUsd || 0);
                  const strkNgn = strkUsdValue * (fxRate || 0);

                  return (
                    <div className="transition-all duration-500 ease-out opacity-100">
                      <div className="text-2xl font-bold">
                        {showNGN
                          ? `₦${strkNgn.toLocaleString()}`
                          : `${strkNum} STRK`}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {showNGN
                          ? `≈ ${strkNum.toFixed(2)} STRK ($${strkUsdValue.toFixed(2)})`
                          : `≈ ₦${strkNgn.toLocaleString()} NGN`}
                      </p>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Account Status
              </CardTitle>

              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>

            <CardContent>
              <div className="text-2xl font-bold">Active</div>

              <p className="text-xs text-muted-foreground">
                Ready for transactions
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>

            <CardContent className="space-y-2">
              {!hasValidWallet ? (
                <Button 
                  className="w-full" 
                  onClick={() => setShowCreateWallet(true)}
                >
                  Create Wallet
                </Button>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={() => setShowFundModal(true)}
                >
                  Fund Crypto
                </Button>
              )}

              <Button
                className="w-full"
                variant="outline"
                onClick={() => setShowTransferModal(true)}
              >
                Transfer Crypto
              </Button>

                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setShowWithdrawalModal(true)}
                  >
                Withdraw to Bank
                  </Button>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => router.push("/history")}
              >
                View History
              </Button>
            </CardContent>
          </Card>

        <Card>
          <CardHeader>
              <CardTitle>Account Information</CardTitle>
          </CardHeader>

            <CardContent className="space-y-4">
                    <div>
                <label className="text-sm font-medium">Name</label>

                <p className="text-sm text-muted-foreground">{userData.name}</p>
                    </div>

              <div>
                <label className="text-sm font-medium">Email</label>

                <p className="text-sm text-muted-foreground">
                  {userData.email}
                </p>
                  </div>

              <div>
                <label className="text-sm font-medium">Wallet Address</label>

                {finalDisplayWallet && hasValidWallet ? (
                  <p className="text-sm font-mono text-muted-foreground break-all">
                    {finalDisplayWallet}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      No wallet created yet
                    </p>

                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowCreateWallet(true)}
                    >
                      Create Wallet
                    </Button>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      <CreatePinModal
        open={showCreateWallet}
        onClose={() => setShowCreateWallet(false)}
        onSuccess={(walletPublicKey) => {
          setUserData((prev) =>
            prev ? { ...prev, chipiWalletAddress: walletPublicKey } : prev
          );
          setShowCreateWallet(false);
        }}
      />
      <WithdrawalModal 
        open={showWithdrawalModal} 
        onClose={() => setShowWithdrawalModal(false)}
        userWalletAddress={userData.chipiWalletAddress || ""}
        bankAccounts={bankAccounts}
      />
      <FundCryptoModal
        open={showFundModal}
        onClose={() => setShowFundModal(false)}
        walletAddress={userData.chipiWalletAddress || ""}
      />
      <TransferCryptoModal
        open={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        usdcBalance={balance}
        strkBalance={strkBalance}
        userWalletAddress={userData.chipiWalletAddress}
      />
              </div>
  );
}
