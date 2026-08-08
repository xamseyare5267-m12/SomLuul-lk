const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 600,
    title: 'SomLuul Desktop - x64',
    icon: path.join(__dirname, 'public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    autoHideMenuBar: true,
  });

  // Remove default menu for clean app appearance
  Menu.setApplicationMenu(null);

  // In production load local dist or remote app URL
  const APP_URL = process.env.APP_URL || 'https://som-luul-zx8l.vercel.app';
  
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // Attempt local static load first or fall back to web URL
    const localHtml = path.join(__dirname, 'dist', 'index.html');
    const fs = require('fs');
    if (fs.existsSync(localHtml)) {
      mainWindow.loadFile(localHtml);
    } else {
      mainWindow.loadURL(APP_URL);
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
