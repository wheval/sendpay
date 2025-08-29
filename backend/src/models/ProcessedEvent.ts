import mongoose, { Schema, Document } from 'mongoose';

export interface IProcessedEvent extends Document {
  transactionHash: string;
  logIndex: number;
  withdrawalId?: string;
  processedAt: Date;
}

const ProcessedEventSchema: Schema = new Schema({
  transactionHash: { type: String, required: true },
  logIndex: { type: Number, required: true },
  withdrawalId: { type: String, required: false },
  processedAt: { type: Date, default: Date.now }
});

// Ensure unique combination of transaction hash and log index
ProcessedEventSchema.index({ transactionHash: 1, logIndex: 1 }, { unique: true });
// Index for withdrawal ID lookups
ProcessedEventSchema.index({ withdrawalId: 1 }, { unique: false, sparse: true });

export const ProcessedEvent = mongoose.model<IProcessedEvent>('ProcessedEvent', ProcessedEventSchema);

