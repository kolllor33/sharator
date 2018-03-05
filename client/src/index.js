import {
  app,
  BrowserWindow,
  Menu,
  ipcMain
} from 'electron';
var path = require("path"),
  fs = require("fs");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

let mainWindow;
let subWindow;

const createWindow = () => {

  let template = [{
      label: "Go To Client",
      click() {
        createSubWindow(`file://${__dirname}/client/client.html`, "Sharator Client");
      }
    },
    // {
    //   label: "How To",
    //   click() {
    //     createSubWindow(`file://${__dirname}/about.html`);
    //   }
    // },
    {
      label: "Terms of Use license",
      click() {
        createSubWindow(`file://${__dirname}/license.html`);
      }
    }

  ];

  if (process.platform === 'darwin') {
    const name = app.getName();
    template = [{
      label: name,
      submenu: [{
          label: "Go To Client",
          click() {
            createSubWindow(`file://${__dirname}/client/client.html`, "Sharator Client");
          }
        },
        {
          label: "How To",
          click() {
            createSubWindow(`file://${__dirname}/about.html`);
          }
        },
        {
          lable: "Terms of Use license",
          click() {
            createSubWindow(`file://${__dirname}/license.html`);
          }
        }
      ]
    }];
  }

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 450,
    height: 450,
    icon: path.join(__dirname, "/assets/icon.png"),
    show: false,
  });

  // and load the index.html of the app.
  mainWindow.loadURL(`file://${__dirname}/index.html`);

  mainWindow.webContents.on('did-finish-load', function () {
    setTimeout(function () {
      mainWindow.show();
    }, 40);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.setMaximizable(false);
  mainWindow.setFullScreenable(false);
  mainWindow.setResizable(false);
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  //mainWindow.webContents.openDevTools();
};

const createSubWindow = (filePath, title) => {
  subWindow = new BrowserWindow({
    width: 450,
    height: 390,
    icon: path.join(__dirname, "/assets/icon.png"),
    show: false,
  });
  if (title) {
    subWindow.setTitle(title);
  }
  subWindow.loadURL(filePath);

  subWindow.webContents.on('did-finish-load', function () {
    setTimeout(function () {
      subWindow.show();
    }, 40);
  });

  subWindow.on('closed', () => {
    subWindow = null;
  });
  subWindow.setMaximizable(false);
  subWindow.setFullScreenable(false);
  subWindow.setResizable(false);
  subWindow.setMenu(null);
  //subWindow.webContents.openDevTools();
};

app.on('ready', createWindow);

// Quit when all windows are closed.
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

//prompt code
var promptResponse = ipcMain.on('prompt', function (eventRet, arg) {
  promptResponse = null
  var promptWindow = new BrowserWindow({
    width: 300,
    height: 120,
    show: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    frame: false,
    icon: path.join(__dirname, "/assets/icon.png")
  })
  arg.val = arg.val || '';
  const promptHtml = '<label for="val">' + arg.title + '</label>\
  <input type="password" id="val" value="' + arg.val + '" autofocus />\
  <button onclick="require(\'electron\').ipcRenderer.send(\'prompt-response\', document.getElementById(\'val\').value);window.close()">Ok</button>\
  <button onclick="window.close()">Cancel</button>';
  promptWindow.loadURL('data:text/html,' + promptHtml + fs.readFileSync(path.join(__dirname, "assets", "promptstyle.prompt")));
  promptWindow.webContents.on('did-finish-load', function () {
    setTimeout(function () {
      promptWindow.show();
    }, 40);
  });
  promptWindow.on('closed', function () {
    eventRet.returnValue = promptResponse;
    promptWindow = null
  });
});

ipcMain.on('prompt-response', function (event, arg) {
  if (arg === '') {
    arg = null;
  }
  promptResponse = arg;
});