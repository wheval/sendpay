'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

export default function PaymentCallback() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'pending'>('loading');
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const [transactionId, setTransactionId] = useState('');

  useEffect(() => {
    const txRef = searchParams.get('tx_ref');
    const transactionId = searchParams.get('transaction_id');
    const status = searchParams.get('status');
    const flwRef = searchParams.get('flw_ref');

    if (txRef) {
      setReference(txRef);
    }

    if (transactionId) {
      setTransactionId(transactionId);
    }

    if (status === 'successful' || status === 'success') {
      setStatus('success');
      setMessage('Payment completed successfully!');
    } else if (status === 'failed' || status === 'cancelled') {
      setStatus('failed');
      setMessage('Payment failed. Please try again.');
    } else if (status === 'pending') {
      setStatus('pending');
      setMessage('Payment is being processed...');
    } else {
      setStatus('pending');
      setMessage('Payment is being processed...');
    }
  }, [searchParams]);

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-500" />;
      case 'failed':
        return <XCircle className="w-16 h-16 text-red-500" />;
      case 'pending':
        return <Clock className="w-16 h-16 text-yellow-500" />;
      default:
        return <AlertCircle className="w-16 h-16 text-blue-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          {getStatusIcon()}
        </div>
        
        <h1 className={`text-2xl font-bold mb-4 ${getStatusColor()}`}>
          {status === 'success' && 'Payment Successful!'}
          {status === 'failed' && 'Payment Failed'}
          {status === 'pending' && 'Processing Payment'}
          {status === 'loading' && 'Loading...'}
        </h1>
        
        <p className="text-gray-600 mb-6">
          {message}
        </p>
        
        {reference && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-500 mb-1">Reference</p>
            <p className="font-mono text-sm font-medium">{reference}</p>
          </div>
        )}

        {transactionId && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">Transaction ID</p>
            <p className="font-mono text-sm font-medium">{transactionId}</p>
          </div>
        )}
        
        <div className="space-y-3">
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
          
          {status === 'failed' && (
            <button
              onClick={() => window.location.href = '/payment'}
              className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
