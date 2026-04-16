const { app, BrowserWindow, Menu, screen } = require('electron');
const path = require('path');
const net = require('net');
const Module = require('module');

const SERVER_PORT = 3001;

// 将 better-sqlite3 的 require 重定向到根目录 node_modules 里重编译过的版本
const rootBetterSqlite3 = path.join(__dirname, '../node_modules/better-sqlite3');
const originalLoad = Module._load.bind(Module);
Module._load = function (request, parent, isMain) {
  if (request === 'better-sqlite3') {
    return originalLoad(rootBetterSqlite3, parent, isMain);
  }
  return originalLoad(request, parent, isMain);
};

// 等待 TCP 端口可用
function waitForPort(port, callback, retries = 40) {
  const client = net.createConnection({ port }, () => {
    client.destroy();
    callback();
  });
  client.on('error', () => {
    if (retries <= 0) {
      console.error('Server failed to start in time');
      app.quit();
      return;
    }
    setTimeout(() => waitForPort(port, callback, retries - 1), 300);
  });
}

// ──────────────────────────────────────────────────────────────
//  桌面宠物
// ──────────────────────────────────────────────────────────────
const PET_W = 140;   // 宠物窗口宽度（与 pet.html canvas 一致）
const PET_H = 180;   // 宠物窗口高度
const EDGE_PX = 2;   // 距屏幕右边缘多少像素触发滑出
const SLIDE_STEP = 14; // 每帧移动像素（约 16ms × 14px = ~875px/s）
const SLIDE_MS = 16;   // 滑动定时器间隔 ms

let petWindow = null;
let petState = 'hidden';   // 'hidden' | 'sliding-in' | 'visible' | 'sliding-out'
let slideTimer = null;

function createPetWindow() {
  const { workAreaSize } = screen.getPrimaryDisplay();

  petWindow = new BrowserWindow({
    width: PET_W,
    height: PET_H,
    x: workAreaSize.width,          // 初始在屏幕右侧外
    y: Math.round((workAreaSize.height - PET_H) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,               // 不抢占焦点
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  petWindow.loadFile(path.join(__dirname, 'pet.html'));

  // 开发时打开 DevTools 可取消注释
  // petWindow.webContents.openDevTools({ mode: 'detach' });
}

function stopSlide() {
  if (slideTimer) {
    clearInterval(slideTimer);
    slideTimer = null;
  }
}

function slidePetIn() {
  if (petState === 'visible' || petState === 'sliding-in') return;
  stopSlide();

  const { workAreaSize } = screen.getPrimaryDisplay();
  const targetX = workAreaSize.width - PET_W;
  const petY = Math.round((workAreaSize.height - PET_H) / 2);

  // 确保窗口已在屏幕外右侧
  petWindow.setPosition(workAreaSize.width, petY);
  petWindow.showInactive();
  petState = 'sliding-in';

  slideTimer = setInterval(() => {
    let [cx] = petWindow.getPosition();
    cx -= SLIDE_STEP;
    if (cx <= targetX) {
      cx = targetX;
      petWindow.setPosition(cx, petY);
      stopSlide();
      petState = 'visible';
      return;
    }
    petWindow.setPosition(cx, petY);
  }, SLIDE_MS);
}

function slidePetOut() {
  if (petState === 'hidden' || petState === 'sliding-out') return;
  stopSlide();

  const { workAreaSize } = screen.getPrimaryDisplay();
  const offscreenX = workAreaSize.width;
  const petY = Math.round((workAreaSize.height - PET_H) / 2);

  petState = 'sliding-out';

  slideTimer = setInterval(() => {
    let [cx] = petWindow.getPosition();
    cx += SLIDE_STEP;
    if (cx >= offscreenX) {
      petWindow.setPosition(offscreenX, petY);
      stopSlide();
      petWindow.hide();
      petState = 'hidden';
      return;
    }
    petWindow.setPosition(cx, petY);
  }, SLIDE_MS);
}

// 全局鼠标位置轮询（100ms 一次，低开销）
function startMouseTracking() {
  setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) return;

    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const right = display.bounds.x + display.bounds.width;

    const atRightEdge = cursor.x >= right - EDGE_PX;

    // ── 触发滑入 ──
    if (atRightEdge && (petState === 'hidden' || petState === 'sliding-out')) {
      slidePetIn();
      return;
    }

    // ── 判断是否离开宠物区域 → 触发滑出 ──
    if (petState === 'visible') {
      const [px, py] = petWindow.getPosition();
      const inBounds =
        cursor.x >= px - 4 &&
        cursor.x <= px + PET_W + 4 &&
        cursor.y >= py - 4 &&
        cursor.y <= py + PET_H + 4;

      if (!inBounds && !atRightEdge) {
        slidePetOut();
      }
    }
  }, 100);
}

// ──────────────────────────────────────────────────────────────
//  应用初始化
// ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  process.env.DATA_DIR = app.getPath('userData');

  const distDir = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist')
    : path.join(__dirname, '../dist');
  process.env.DIST_DIR = distDir;

  require('../server/index');

  // 主窗口
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 820,
    minHeight: 580,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    title: '提醒事项',
    show: false,
  });

  Menu.setApplicationMenu(null);

  waitForPort(SERVER_PORT, () => {
    mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    app.quit();
  });

  // 宠物窗口
  createPetWindow();
  startMouseTracking();
});

app.on('window-all-closed', () => {
  app.quit();
});
