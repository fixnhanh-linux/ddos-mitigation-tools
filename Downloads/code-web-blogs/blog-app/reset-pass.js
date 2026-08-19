const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/web-blogs';

async function resetPass() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');
  
  const newPassword = 'Admin@123';
  const hash = await bcrypt.hash(newPassword, 12);
  
  const result = await mongoose.connection.collection('users').updateMany(
    {},
    { $set: { password: hash } }
  );
  
  console.log('Updated:', result.modifiedCount, 'users');
  console.log('===========================================');
  console.log('Mat khau moi cho TAT CA users: ' + newPassword);
  console.log('===========================================');
  await mongoose.disconnect();
}

resetPass().catch(console.error);
