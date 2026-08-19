const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/web-blogs';

async function checkUsers() {
  await mongoose.connect(MONGODB_URI);
  const users = await mongoose.connection.collection('users').find({}).toArray();
  
  console.log('\n=== DANH SACH USERS ===');
  for (const u of users) {
    const isHashed = u.password && u.password.startsWith('$2');
    const testOk = isHashed ? await bcrypt.compare('Admin@123', u.password) : false;
    console.log(`Email: ${u.email}`);
    console.log(`  Pass hashed: ${isHashed ? 'YES' : 'NO (plain text!)'}`);
    console.log(`  Test Admin@123: ${testOk ? 'MATCH OK' : 'FAIL'}`);
    console.log(`  Raw pass (10 chars): ${u.password ? u.password.substring(0, 10) + '...' : 'NONE'}`);
    console.log('');
  }
  await mongoose.disconnect();
}

checkUsers().catch(console.error);
