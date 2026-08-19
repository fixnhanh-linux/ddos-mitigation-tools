const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/next-blog').then(async () => {
  const Setting = mongoose.model('Setting', new mongoose.Schema({ key: String, value: String, group: String }));
  const settings = {
    hero_title: 'Chào mừng đến với NextBlog',
    hero_desc: 'Chưa có bài viết nào được xuất bản. Hãy đăng nhập quản trị để viết bài đầu tiên!',
    newsletter_title: 'Đừng bỏ lỡ tin tức mới',
    newsletter_desc: 'Đăng ký nhận bản tin hàng tuần để cập nhật những bài viết, xu hướng công nghệ mới nhất trực tiếp vào hộp thư của bạn.',
    footer_newsletter_title: 'Đăng ký nhận bản tin',
    footer_newsletter_desc: 'Nhận những bài viết mới nhất, mẹo lập trình và tin tức công nghệ gửi trực tiếp vào hộp thư của bạn mỗi tuần.',
    footer_copyright: 'Tất cả bản quyền được bảo lưu.',
    footer_tech: 'Được xây dựng bằng Next.js, MongoDB và TailwindCSS.'
  };
  const ops = Object.keys(settings).map(k => ({
    updateOne: { filter: { key: k }, update: { $set: { value: settings[k], group: 'general' } }, upsert: true }
  }));
  await Setting.bulkWrite(ops);
  console.log('Done inserting UI settings to DB');
  process.exit(0);
});
