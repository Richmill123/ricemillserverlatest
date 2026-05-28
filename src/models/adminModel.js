import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username cannot exceed 20 characters'],
      match: [/^[a-zA-Z0-9/]+$/, 'Username can only contain letters, numbers, and forward slashes'],
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      validate: {
        validator: function(password) {
          // At least one uppercase, one lowercase, one number, and one special character
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password);
        },
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      }
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
    },
    passwordResetExpires: {
      type: Date,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
    },
    subscription: {
      razorpaySubscriptionId: { type: String },
      status: {
        type: String,
        enum: ['created','authenticated','active','paused','halted','cancelled','completed','expired'],
      },
      nextBillingAt: { type: Date },
      paymentId:     { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Virtual for checking if account is locked
adminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Method to compare password with login attempt tracking
adminSchema.methods.matchPassword = async function (enteredPassword) {
  if (this.isLocked) {
    throw new Error('Account is temporarily locked due to multiple failed login attempts');
  }
  
  const isMatch = await bcrypt.compare(enteredPassword, this.password);

  if (!isMatch) {
    const newAttempts = this.loginAttempts + 1;
    const update = { loginAttempts: newAttempts };
    if (newAttempts >= 5) {
      update.lockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000);
    }
    await this.constructor.updateOne({ _id: this._id }, { $set: update });
    return false;
  }

  if (this.loginAttempts > 0) {
    await this.constructor.updateOne(
      { _id: this._id },
      { $set: { loginAttempts: 0 }, $unset: { lockUntil: '' } }
    );
  }

  return true;
};

// Method to generate password reset token
adminSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Method to clear password reset fields
adminSchema.methods.clearPasswordResetFields = function() {
  this.passwordResetToken = undefined;
  this.passwordResetExpires = undefined;
};

const Admin = mongoose.model('Admin', adminSchema);

export default Admin;
