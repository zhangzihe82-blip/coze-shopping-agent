// 服务器启动器 (CommonJS)
const path = require('path');
process.env.PORT = process.env.PORT || '5000';

async function start() {
  const mainPath = path.join(__dirname, 'main.js');
  console.log('加载:', mainPath);
  await import('file:///' + mainPath.replace(/\\/g, '/'));
  console.log('服务器已加载');
}

start().catch(e => {
  console.error('启动失败:', e.message);
  process.exit(1);
});
