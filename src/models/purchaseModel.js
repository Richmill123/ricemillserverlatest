import mongoose from 'mongoose';

// Item sub-schema for line items in a purchase
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
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

const purchaseSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      index: true,
    },
    supplier: {
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
    paymentStatus: {
      type: String,
      enum: ['paid', 'pending', 'partial'],
      default: 'pending',
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    purchaseDate: {
      type: Date,
      required: true,
      default: Date.now,
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

purchaseSchema.index({ purchaseDate: -1, clientId: 1 });

const Purchase = mongoose.model('Purchase', purchaseSchema);

export default Purchase;
