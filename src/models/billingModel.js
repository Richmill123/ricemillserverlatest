import mongoose from 'mongoose';

// Item sub-schema for line items in an invoice
const itemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  rate: {
    type: Number,
    required: true,
    min: 0,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

const billingSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      index: true,
    },
    invoiceNo: {
      type: String,
      required: true,
      trim: true,
    },
    billNumber: {
      type: String,
      trim: true,
    },
    invoiceDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    items: [itemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'unpaid', 'partial'],
      default: 'draft',
    },
    notes: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

billingSchema.index({ invoiceNo: 1, clientId: 1 }, { unique: true });
billingSchema.index({ invoiceDate: -1, clientId: 1 });

const Billing = mongoose.model('Billing', billingSchema);

export default Billing;
