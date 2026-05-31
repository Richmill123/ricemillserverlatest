import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
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
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    dob: {
      type: Date,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    emergencyContactNumber: {
      type: String,
      required: true,
    },
    maritalStatus: {
      type: String,
      enum: ['Single', 'Married', 'Divorced', 'Widowed'],
      required: true,
    },
    salary: {
      type: Number,
      required: true,
    },
    advanceAmount: {
      type: Number,
      default: 0,
    },
    debtAmount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Employee = mongoose.model('Employee', employeeSchema);

export default Employee;
