const mongoose = require('mongoose');

async function verifyUser() {
  await mongoose.connect('mongodb://127.0.0.1:27017/web-blogs');
  const result = await mongoose.connection.collection('users').updateOne(
    { email: 'admin@example.com' },
    { $set: { isVerified: true } }
  );
  console.log('Update result:', result);
  await mongoose.disconnect();
}

verifyUser().catch(console.error);
