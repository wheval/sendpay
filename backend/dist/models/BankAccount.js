"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankAccount = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const BankAccountSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    bankName: {
        type: String,
        required: true,
        trim: true
    },
    accountNumber: {
        type: String,
        required: true,
        trim: true
    },
    accountName: {
        type: String,
        required: true,
        trim: true
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});
// Indexes for better query performance
BankAccountSchema.index({ userId: 1 });
BankAccountSchema.index({ accountNumber: 1 });
BankAccountSchema.index({ isDefault: 1 });
// Ensure only one default account per user
BankAccountSchema.pre('save', async function (next) {
    if (this.isDefault) {
        // Remove default flag from other accounts
        await mongoose_1.default.model('BankAccount').updateMany({ userId: this.userId, _id: { $ne: this._id } }, { isDefault: false });
    }
    next();
});
// Virtual for masked account number
BankAccountSchema.virtual('maskedAccountNumber').get(function () {
    const accountNumber = this.accountNumber;
    if (accountNumber.length <= 4)
        return accountNumber;
    return `${accountNumber.slice(0, 4)}****${accountNumber.slice(-4)}`;
});
// Ensure virtual fields are serialized
BankAccountSchema.set('toJSON', { virtuals: true });
BankAccountSchema.set('toObject', { virtuals: true });
exports.BankAccount = mongoose_1.default.model('BankAccount', BankAccountSchema);
//# sourceMappingURL=BankAccount.js.map