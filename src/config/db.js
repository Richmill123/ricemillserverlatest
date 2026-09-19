import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Stock from '../models/stockModel.js';
import Billing from '../models/billingModel.js';

dotenv.config();

// Cached promise — prevents duplicate mongoose.connect() calls during concurrent cold starts
let connectionPromise = null;
let indexesInitialized = false;

const connectDB = async () => {
  // Already connected — fast path
  if (mongoose.connection.readyState === 1) return;

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined');
  }

  // Reuse in-flight connection promise so concurrent requests share one attempt
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    }).then((conn) => {
      console.log(`MongoDB connected: ${conn.connection.host}`);

      mongoose.connection.on('error', (err) => console.error('MongoDB error:', err));
      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected');
        connectionPromise = null; // allow reconnect on next request
      });
    });
  }

  await connectionPromise;

  // One-time index setup per process
  if (!indexesInitialized) {
    indexesInitialized = true;
    try {
      const indexes = await Stock.collection.indexes();
      const legacyIndex = indexes.find((idx) => idx?.name === 'itemType_1');
      if (legacyIndex) {
        await Stock.collection.dropIndex('itemType_1');
        console.log('Dropped legacy unique index stocks.itemType_1');
      }
      await Stock.collection.createIndex({ clientId: 1, itemType: 1 }, { unique: true });
    } catch (indexErr) {
      console.error('Stock index initialization error:', indexErr.message || indexErr);
    }

    // Drop stale single-field unique index on billings.invoiceNo (replaced by compound invoiceNo+clientId)
    try {
      const billingIndexes = await Billing.collection.indexes();
      const staleIndex = billingIndexes.find((idx) => idx?.name === 'invoiceNo_1');
      if (staleIndex) {
        await Billing.collection.dropIndex('invoiceNo_1');
        console.log('Dropped legacy unique index billings.invoiceNo_1');
      }
      await Billing.collection.createIndex({ invoiceNo: 1, clientId: 1 }, { unique: true });
    } catch (indexErr) {
      console.error('Billing index initialization error:', indexErr.message || indexErr);
    }
  }
};

export default connectDB;
