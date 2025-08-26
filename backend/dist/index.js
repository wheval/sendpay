"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const auth_1 = require("./routes/auth");
const user_1 = require("./routes/user");
const payment_1 = require("./routes/payment");
const transaction_1 = require("./routes/transaction");
const starknet_1 = require("./routes/starknet");
const cavos_1 = require("./routes/cavos");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Database connection
mongoose_1.default.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sendpay')
    .then(() => {
    console.log('✅ Connected to MongoDB');
})
    .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
});
// Routes
app.use('/api/auth', auth_1.authRoutes);
app.use('/api/user', user_1.userRoutes);
app.use('/api/payment', payment_1.paymentRoutes);
app.use('/api/transaction', transaction_1.transactionRoutes);
app.use('/api/starknet', starknet_1.starknetRoutes);
app.use('/api/cavos', cavos_1.cavosRoutes);
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
app.use((err, req, res, next) => {
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
});
exports.default = app;
//# sourceMappingURL=index.js.map