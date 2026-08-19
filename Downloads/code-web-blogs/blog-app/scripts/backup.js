const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Cấu hình
const DB_NAME = 'nextblog'; // Đổi thành tên DB của bạn
const BACKUP_DIR = path.join(__dirname, 'backups');

// Đảm bảo thư mục backup tồn tại
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const date = new Date();
const timestamp = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}_${date.getHours()}-${date.getMinutes()}`;
const backupFile = path.join(BACKUP_DIR, `${DB_NAME}_backup_${timestamp}.archive`);

// Lệnh chạy mongodump (yêu cầu máy chủ/máy cài MongoDB Database Tools)
// Ví dụ với Localhost:
const cmd = `mongodump --db ${DB_NAME} --archive=${backupFile} --gzip`;

console.log(`Đang tiến hành sao lưu Database ${DB_NAME}...`);

exec(cmd, (error, stdout, stderr) => {
  if (error) {
    console.error(`Lỗi sao lưu: ${error.message}`);
    return;
  }
  if (stderr) {
    console.log(`Trạng thái: ${stderr}`);
  }
  console.log(`✅ Sao lưu thành công! File được lưu tại: ${backupFile}`);
  console.log(`Bạn có thể setup Cronjob để chạy file này mỗi đêm lúc 2h sáng: '0 2 * * * node scripts/backup.js'`);
});
