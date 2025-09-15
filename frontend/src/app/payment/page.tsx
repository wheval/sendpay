'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, XCircle, Wallet } from 'lucide-react';

interface PaymentForm {
  amount: string;
  token: 'USDC' | 'STRK';
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

export default function PaymentPage() {
  const [formData, setFormData] = useState<PaymentForm>({
    amount: '',
    token: 'USDC',
    bankCode: '044',
    accountNumber: '',
    accountName: ''
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setStatus('processing');
    setMessage('Processing payment...');

    try {
      // This would integrate with Cavos for wallet functionality
      // For now, we'll simulate the process
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setStatus('success');
      setMessage('Payment processed successfully! Check your bank account for NGN transfer.');
      
    } catch (error) {
      setStatus('error');
      setMessage('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />;
      default:
        return <Wallet className="h-8 w-8 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SendPay</h1>
          <p className="text-gray-600">Crypto in. Cash out instantly to your Nigerian bank account.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Process Withdrawal
            </CardTitle>
            <CardDescription>
              Enter your withdrawal details. Cavos will handle the wallet connection and token approval.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="100"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="token">Token</Label>
                  <Select value={formData.token} onValueChange={(value: 'USDC' | 'STRK') => setFormData({ ...formData, token: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USDC">USDC</SelectItem>
                      <SelectItem value="STRK">STRK</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="bankCode">Bank Code</Label>
                <Input
                  id="bankCode"
                  placeholder="044 (Access Bank)"
                  value={formData.bankCode}
                  onChange={(e) => setFormData({ ...formData, bankCode: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  placeholder="0123456789"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="accountName">Account Name</Label>
                <Input
                  id="accountName"
                  placeholder="John Doe"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  required
                />
              </div>

              {status !== 'idle' && (
                <div className={status === 'success' ? 'border-green-200 bg-green-50' : status === 'error' ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}>
                  <div className="flex items-center gap-2">
                    {getStatusIcon()}
                    <div className="text-sm text-gray-600">{message}</div>
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Process Withdrawal'
                )}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-sm text-gray-700 mb-2">How it works:</h3>
              <ol className="text-sm text-gray-600 space-y-1">
                <li>1. Cavos connects your Starknet wallet</li>
                <li>2. Approve USDC/STRK tokens for SendPay contract</li>
                <li>3. Contract processes withdrawal and emits event</li>
                <li>4. Backend triggers Flutterwave NGN transfer</li>
                <li>5. Receive NGN in your Nigerian bank account (1-3 minutes)</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
