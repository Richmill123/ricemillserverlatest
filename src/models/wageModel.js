import mongoose from 'mongoose';

const wageSchema = new mongoose.Schema(
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
    },
    advanceWage: {
      type: Number,
      default: 0,
    },
    advanceamount: {
      type: Number,
      default: 0,
    },
    totalWage: {
      type: Number,
      required: true,
    },
    balanceWage: {
      type: Number,
      default: function() {
        return this.totalWage - this.advanceWage;
      },
    },
    typeOfWork: {
      type: String,
      enum: ['boiling', 'splitting', 'other'],
      required: true,
    },
    machineType: {
      type: String,
      enum: ['Electric', 'Manual', 'Hybrid'],
      required: true,
    },
    advancedebtamount: {
      type: Number,
      default: 0,
    },
    bags: {
      type: Number,
      default: 0,
      min: 0,
    },
    date: {
      type: Date
    },
    note: {
      type: String
    }
  },
  {
    timestamps: true,
  }
);

// Update balanceWage before saving
wageSchema.pre('save', function(next) {
  this.balanceWage = this.totalWage - this.advanceWage;
  next();
});

const Wage = mongoose.model('Wage', wageSchema);

export default Wage;
