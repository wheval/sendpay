# SendPay Frontend

This is the frontend application for SendPay, built with Next.js, React, and shadcn/ui.

## Features

- **Authentication**: Login and onboarding with ChipiPay SDK integration
- **Dashboard**: User balance, wallet information, and quick actions
- **Receive Payments**: Create payment requests with QR codes and shareable links
- **Withdraw Funds**: Withdraw to bank accounts with real-time balance checking
- **Crypto Transfers**: Send STRK/USDC with PIN authentication
- **Transaction History**: View and filter all transactions with search capabilities
- **Dark Mode**: Full dark/light theme support
- **Responsive Design**: Mobile-first design with responsive navigation

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **UI Library**: React 18
- **Styling**: Tailwind CSS with shadcn/ui components
- **Theme**: next-themes for dark mode support
- **Icons**: Lucide React
- **State Management**: React hooks and local storage
- **API**: Custom API client for backend communication

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env.local` file with:
   ```env
   # API Configuration
   NEXT_PUBLIC_API_BASE=http://localhost:3001/api
   
   # USDC Token Address (Starknet)
   NEXT_PUBLIC_USDC_ADDRESS=0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf56a5fc
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

4. **Build for Production**:
   ```bash
   npm run build
   npm start
   ```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Dashboard page
│   ├── login/            # Login and onboarding
│   ├── receive/          # Receive payments
│   ├── withdraw/         # Withdraw funds
│   ├── history/          # Transaction history
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page (redirects)
├── components/            # Reusable components
│   ├── ui/               # shadcn/ui components
│   └── navigation.tsx    # Main navigation
└── lib/                  # Utility functions
    ├── api.ts            # API client
    └── utils.ts          # Helper functions
```

## API Integration

The frontend communicates with the backend through the API client in `src/lib/api.ts`. All API calls include:

- **Authentication**: JWT tokens for protected routes
- **Error Handling**: Consistent error handling across all endpoints
- **Type Safety**: Full TypeScript support for API responses

## Key Components

- **Navigation**: Responsive navigation with theme toggle
- **Theme Provider**: Dark/light mode support with system preference detection
- **API Client**: Centralized API communication with error handling
- **Form Components**: Reusable form elements with validation

## Development

- **Code Style**: ESLint with Next.js configuration
- **TypeScript**: Strict type checking enabled
- **Responsive**: Mobile-first design approach
- **Accessibility**: ARIA labels and semantic HTML

## Backend Integration

This frontend is designed to work with the SendPay backend API. Ensure the backend is running on `http://localhost:3001` or update the `NEXT_PUBLIC_API_BASE` environment variable accordingly.
