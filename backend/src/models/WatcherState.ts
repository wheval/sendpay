import mongoose, { Schema, Document } from 'mongoose';

export interface IWatcherState extends Document {
  key: string;
  lastProcessedBlock: number;
  updatedAt: Date;
}

const WatcherStateSchema: Schema = new Schema({
  key: { type: String, required: true, unique: true },
  lastProcessedBlock: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now }
});

export const WatcherState = mongoose.model<IWatcherState>('WatcherState', WatcherStateSchema);

