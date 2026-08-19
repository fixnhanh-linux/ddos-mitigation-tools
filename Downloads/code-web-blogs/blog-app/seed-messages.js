const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/web-blogs').then(async () => {
  const User = mongoose.model('User', new mongoose.Schema({ name: String, email: String, role: String }, { strict: false }));
  const Message = mongoose.model('Message', new mongoose.Schema({ sender: mongoose.Schema.Types.ObjectId, receiver: mongoose.Schema.Types.ObjectId, content: String, read: Boolean }, { timestamps: true, strict: false }));

  await User.deleteMany({ email: { $in: ['admin2@test.com', 'author1@test.com', 'editor1@test.com'] } });
  
  const admin = await User.findOne();
  const user1 = await User.create({ name: 'Hoàng Tác Giả', email: 'author1@test.com', role: 'author' });
  const user2 = await User.create({ name: 'Lan Biên Tập', email: 'editor1@test.com', role: 'editor' });
  const user3 = await User.create({ name: 'Admin 2', email: 'admin2@test.com', role: 'admin' });

  if(admin) {
    await Message.create({ sender: admin._id, receiver: user1._id, content: 'Chào em, bài viết về Next.js chiều nay đã xong chưa?', read: true, createdAt: new Date(Date.now() - 3600000) });
    await Message.create({ sender: user1._id, receiver: admin._id, content: 'Dạ, em đang dùng AI Assistant để tối ưu lại tiêu đề SEO. Khoảng 30 phút nữa em Publish nhé!', read: false, createdAt: new Date(Date.now() - 1800000) });
    await Message.create({ sender: admin._id, receiver: user1._id, content: 'Ok chốt bài viết chiều nay nhé!', read: false, createdAt: new Date(Date.now() - 900000) });
    
    await Message.create({ sender: user2._id, receiver: admin._id, content: 'Hình ảnh bài mới bị lỗi font rồi sếp ơi', read: false, createdAt: new Date(Date.now() - 86400000) });
  }
  
  console.log('Seeded messages');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
