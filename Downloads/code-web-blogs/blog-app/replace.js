const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(path.join(dir, f));
    }
  });
}

walkDir(path.join(__dirname, 'src'), function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.js')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Thay thế chữ hiển thị
    content = content.replace(/NextBlog/g, 'Tên Website');
    
    // 2. Thay thế email và domain
    content = content.replace(/nextblog\.vn/g, 'tenwebsite.com');
    content = content.replace(/nextblog\.com/g, 'tenwebsite.com');
    content = content.replace(/admin@nextblog/g, 'admin@tenwebsite');
    
    // 3. Thay thế localstorage key và các biến viết thường
    content = content.replace(/nextblog_/g, 'myblog_');
    content = content.replace(/ref=nextblog/g, 'ref=myblog');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated:', filePath);
    }
  }
});

// Update root layout as well if outside src
const rootLayout = path.join(__dirname, 'src', 'app', 'layout.tsx');
if(fs.existsSync(rootLayout)) {
  let content = fs.readFileSync(rootLayout, 'utf8');
  content = content.replace(/NextBlog/g, 'Tên Website');
  fs.writeFileSync(rootLayout, content, 'utf8');
}

// Update error.tsx
const errorPage = path.join(__dirname, 'src', 'app', 'error.tsx');
if(fs.existsSync(errorPage)) {
  let content = fs.readFileSync(errorPage, 'utf8');
  content = content.replace(/NextBlog/g, 'Tên Website');
  fs.writeFileSync(errorPage, content, 'utf8');
}

console.log("Done replacing all NextBlog occurrences.");
