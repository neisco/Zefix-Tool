const { app, BrowserWindow } = require('electron');
const path = require('path');
const electronServe = require('electron-serve');
const serve = electronServe.default || electronServe;

const loadURL = serve({ directory: 'out' });

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Erlaubt fetch-Aufrufe an externe APIs ohne CORS
    },
    title: 'Zefix Excel Enrichment Tool'
  });

  const isDev = !app.isPackaged;
  
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    loadURL(win);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
