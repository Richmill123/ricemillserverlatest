import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
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
    villageName: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    numberOfBags: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    advanceAmount: {
      type: Number,
      required: true,
    },
    typeOfPaddy: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: 'CREATED',
    },
    splittingincome: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model('Order', orderSchema);

export default Order;
