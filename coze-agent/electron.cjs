const { app, BrowserWindow, Menu, shell, nativeImage, dialog, utilityProcess } = require('electron');
const path = require('path');
const { execSync } = require('child_process');

let mainWindow = null;
let serverProcess = null;
const PORT = 5000;

const startHtml = (port) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>灵犀市场洞察</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center}
.container{text-align:center;padding:40px;max-width:900px}
.logo{width:80px;height:80px;background:rgba(255,255,255,0.1);border-radius:20px;margin:0 auto 24px;display:flex;align-items:center;justify-content:center}
h1{color:#fff;font-size:32px;margin-bottom:8px;font-weight:700}
.subtitle{color:rgba(255,255,255,0.6);font-size:14px;margin-bottom:40px}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:640px;margin:0 auto}
.card{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:28px 20px;cursor:pointer;transition:all 0.25s;text-decoration:none;color:inherit;text-align:left}
.card:hover{background:rgba(255,255,255,0.14);transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,0.3)}
.card-icon{font-size:32px;margin-bottom:12px}
.card h3{font-size:17px;color:#fff;margin-bottom:6px;font-weight:600}
.card p{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.5}
</style></head>
<body><div class="container">
<div class="logo"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
<h1>灵犀市场洞察</h1><p class="subtitle">AI电商智能运营中心</p>
<div class="cards">
<a class="card" href="http://localhost:${port}/"><div class="card-icon">⚡</div><h3>运营中心</h3><p>实时电商动态 · 新闻瀑布流 · 选品推荐 · 内容生成 · 定价策略</p></a>
<a class="card" href="http://localhost:${port}/guide.html"><div class="card-icon">🛒</div><h3>导购助手</h3><p>买家/卖家双模式 · 智能推荐 · 商品对比 · 购物决策</p></a>
<a class="card" href="http://localhost:${port}/market"><div class="card-icon">📈</div><h3>市场监测</h3><p>竞品分析 · 市场趋势 · 每日运营报告</p></a>
<a class="card" href="http://localhost:${port}/xhs"><div class="card-icon">📕</div><h3>小红书发布</h3><p>AI生成文案 · 一键发布 · 多账号管理</p></a>
</div></div></body></html>`;

const loadingHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>灵犀市场洞察</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);font-family:-apple-system,sans-serif}.c{text-align:center;color:#fff}h1{font-size:28px;margin:0 0 12px}p{font-size:16px;opacity:.6}.s{width:40px;height:40px;margin:24px auto 0;border:3px solid rgba(255,255,255,.15);border-top-color:#fff;border-radius:50%;animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}</style></head>
<body><div class="c"><h1>灵犀市场洞察</h1><p>正在启动服务...</p><div class="s"></div></div></body></html>`;

function freePort() {
  try {
    execSync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${PORT}') do taskkill /F /PID %a 2>nul`, { timeout: 5000, stdio: 'ignore' });
  } catch (e) {}
}

function createWindow() {
  const iconPath = path.resolve(__dirname, 'build', 'icon.ico');
  let icon = null;
  try { icon = nativeImage.createFromPath(iconPath); } catch (e) {}

  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    title: '灵犀市场洞察',
    icon: icon && !icon.isEmpty() ? icon : undefined,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    show: false, backgroundColor: '#0f0c29'
  });

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHtml)}`);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.on('closed', () => { mainWindow = null; });

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '文件', submenu: [{ label: '刷新', click: () => mainWindow?.reload() }, { type: 'separator' }, { label: '退出', click: () => app.quit() }]},
    { label: '导航', submenu: [
      { label: '首页', click: () => mainWindow?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(startHtml(PORT))}`) },
      { label: '运营中心', click: () => mainWindow?.loadURL(`http://localhost:${PORT}/`) },
      { label: '导购助手', click: () => mainWindow?.loadURL(`http://localhost:${PORT}/guide.html`) },
      { label: '市场监测', click: () => mainWindow?.loadURL(`http://localhost:${PORT}/market`) },
      { label: '小红书发布', click: () => mainWindow?.loadURL(`http://localhost:${PORT}/xhs`) }
    ]},
    { label: '帮助', submenu: [{ label: '关于', click: () => dialog.showMessageBox(mainWindow, { type: 'info', title: '关于', message: '灵犀市场洞察 v1.0.1', detail: 'AI电商智能运营中心' }) }] }
  ]));
}

app.whenReady().then(async () => {
  freePort();
  createWindow();

  const serverPath = path.resolve(__dirname, 'server.cjs');
  console.log('启动服务器:', serverPath);

  serverProcess = utilityProcess.fork(serverPath, [], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT) }
  });

  serverProcess.stdout?.on('data', (d) => console.log('[SVR]', d.toString().trim()));
  serverProcess.stderr?.on('data', (d) => console.error('[ERR]', d.toString().trim()));
  serverProcess.on('exit', (c) => { console.log('svr exit:', c); serverProcess = null; });

  // 等待服务器就绪，然后加载首页
  const checkServer = async () => {
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://localhost:${PORT}/api/health`);
        if (res.ok) {
          console.log('服务器就绪');
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(startHtml(PORT))}`);
          }
          return;
        }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 500));
    }
    console.log('服务器超时，仍加载首页');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(startHtml(PORT))}`);
    }
  };
  checkServer();

  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (serverProcess) { serverProcess.kill(); serverProcess = null; } freePort(); });
