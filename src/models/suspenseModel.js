import mongoose from 'mongoose';

const suspenseSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      index: true
    },
    employeeId: {
      type: String,
      required: true,
    },
    employeeName: {
      type: String,
      required: true,
      trim: true,
    },
    totalDebt: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAdvance: {
      type: Number,
      default: 0,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Suspense = mongoose.model('Suspense', suspenseSchema);

export default Suspense;
