require('dotenv').config();
const mongoose = require('mongoose');

async function disableMaintenance() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Using native collection to bypass schema
    const result = await mongoose.connection.collection('settings').updateOne(
      { key: 'maintenance_mode' },
      { $set: { value: false } }
    );
    
    console.log('Update result:', result);
    console.log('Maintenance mode disabled successfully!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

disableMaintenance();
