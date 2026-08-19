const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function fixPass() {
  await mongoose.connect('mongodb://127.0.0.1:27017/web-blogs');
  const hash = await bcrypt.hash('Khai@123.!', 10);
  const result = await mongoose.connection.collection('users').updateOne(
    { email: 'admin@example.com' },
    { $set: { password: hash } }
  );
  console.log('Update result:', result);
  await mongoose.disconnect();
}

fixPass().catch(console.error);
