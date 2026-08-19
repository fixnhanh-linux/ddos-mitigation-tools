const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/web-blogs';

async function resetOne() {
  await mongoose.connect(MONGODB_URI);
  const newPassword = 'Admin@123';
  const hash = await bcrypt.hash(newPassword, 12);
  
  const result = await mongoose.connection.collection('users').updateOne(
    { email: 'author1@test.com' },
    { $set: { password: hash } }
  );
  
  console.log('Updated:', result.modifiedCount, 'user');
  console.log('author1@test.com -> mat khau moi: ' + newPassword);
  await mongoose.disconnect();
}

resetOne().catch(console.error);
