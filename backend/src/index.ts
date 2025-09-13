// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/user';
import { paymentRoutes } from './routes/payment';
import { transactionRoutes } from './routes/transaction';
import { starknetRoutes } from './routes/starknet';
import { cavosRoutes } from './routes/cavos';
import { apibaraRoutes } from './routes/apibara';
import { flutterwaveRoutes } from './routes/flutterwave';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',           // Frontend dev server
    'http://localhost:3001',           // Backend dev server
    'https://sendpay-five.vercel.app', // Vercel frontend
    'https://sendpay.vercel.app'       // Vercel frontend
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Debug middleware to log CORS issues
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sendpay')
  .then(() => {
    console.log('✅ Connected to MongoDB');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/starknet', starknetRoutes);
app.use('/api/cavos', cavosRoutes);
app.use('/api/apibara', apibaraRoutes);
app.use('/api/flutterwave', flutterwaveRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'SendPay Backend API',
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SendPay Backend API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 CORS enabled for: ${corsOptions.origin.join(', ')}`);
});

export default app;
