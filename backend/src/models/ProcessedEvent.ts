import mongoose, { Schema, Document } from 'mongoose';

export interface IProcessedEvent extends Document {
  txHash: string;
  logIndex: number;
  eventType?: string;
  eventData?: any;
  withdrawalId?: string;
  processedAt: Date;
}

const ProcessedEventSchema = new Schema<IProcessedEvent>({
  txHash: { type: String, required: true },
  logIndex: { type: Number, required: true },
  eventType: { type: String },
  eventData: { type: Schema.Types.Mixed },
  withdrawalId: { type: String },
  processedAt: { type: Date, default: Date.now }
});

// Compound index to ensure uniqueness
ProcessedEventSchema.index({ txHash: 1, logIndex: 1 }, { unique: true });

export const ProcessedEvent = mongoose.model<IProcessedEvent>('ProcessedEvent', ProcessedEventSchema);

