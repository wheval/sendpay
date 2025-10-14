'use client';

import { ChipiClientProvider } from '@chipi-stack/nextjs';

interface ChipiProviderProps {
  children: React.ReactNode;
}

export function ChipiProvider({ children }: ChipiProviderProps) {
  const apiKey = process.env.NEXT_PUBLIC_CHIPI_API_KEY;
  const chipiEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development';

  if (!apiKey) {
    console.error('NEXT_PUBLIC_CHIPI_API_KEY is not set');
    return <>{children}</>;
  }

  return (
    <ChipiClientProvider apiPublicKey={apiKey} environment={chipiEnv}>
      {children}
    </ChipiClientProvider>
  );
}


