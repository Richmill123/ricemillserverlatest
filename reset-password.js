import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const newPassword = process.argv[2];

if (!newPassword) {
  console.error('Usage: node reset-password.js <new-password>');
  console.error('Example: node reset-password.js Admin@1234');
  process.exit(1);
}

if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/.test(newPassword)) {
  console.error('Password must be 8+ chars with uppercase, lowercase, number, and special char (@$!%*?&)');
  process.exit(1);
}

async function resetPassword() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const hash = await bcrypt.hash(newPassword, 12);

  const result = await mongoose.connection.collection('admins').updateOne(
    { username: 'bbk/admin' },
    {
      $set: { password: hash, loginAttempts: 0 },
      $unset: { lockUntil: '' }
    }
  );

  if (result.matchedCount === 0) {
    console.error('Admin user "bbk/admin" not found');
    process.exit(1);
  }

  console.log('Password reset successfully for bbk/admin');
  console.log('New password:', newPassword);
  await mongoose.disconnect();
}

resetPassword().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
