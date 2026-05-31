import mongoose from 'mongoose';

const saleSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    items: [
      {
        itemType: {
          type: String,
          enum: ['bran', 'husk', 'black rice', 'broken rice', 'others', 'Karika'],
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        rate: {
          type: Number,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    mydebt: {
      type: Number,
      default: 0,
    },
    partialAmountPaid: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Pending', 'Partially Paid'],
      default: 'Pending',
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'UPI', 'Bank Transfer', 'Other'],
      default: 'Cash',
    },
  },
  {
    timestamps: true,
  }
);

// Calculate total amount before saving
saleSchema.pre('save', function(next) {
  this.totalAmount = this.items.reduce((total, item) => total + item.amount, 0);
  next();
});

const Sale = mongoose.model('Sale', saleSchema);

export default Sale;
