import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Stock from '../models/stockModel.js';

dotenv.config();

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in your .env file');
    }

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 10s
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    try {
      const indexes = await Stock.collection.indexes();
      const legacyIndex = indexes.find((idx) => idx && idx.name === 'itemType_1');

      if (legacyIndex) {
        await Stock.collection.dropIndex('itemType_1');
        console.log('Dropped legacy unique index stocks.itemType_1');
      }

      await Stock.collection.createIndex({ clientId: 1, itemType: 1 }, { unique: true });
    } catch (indexErr) {
      console.error('Stock index initialization error:', indexErr.message || indexErr);
    }
    
    // Connection events
    mongoose.connection.on('connected', () => {
      console.log(`MongoDB connected: ${conn.connection.host}`);
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.error('Make sure your MongoDB server is running and accessible');
    console.error('If using MongoDB Atlas, check if your IP is whitelisted');
    if (process.env.VERCEL) {
      throw error;
    }
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
    process.exit(1);
  }
});

export default connectDB;
