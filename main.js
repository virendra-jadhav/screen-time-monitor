// main.js - Main Electron process
const {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  Tray,
  Menu,
  powerMonitor,
  screen,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
class ScreenTimeMonitor {
  constructor() {
    this.mainWindow = null;
    this.tray = null;
    this.usageTime = 0;
    this.breakThreshold = 30 * 60; // 30 min in seconds
    this.isMonitoring = false;
    this.isBreakTime = false;
    this.lastActivityTime = Date.now();
    this.monitorInterval = null;
    this.lastUserActivity = Date.now(); // Update user activity time
    this.settingsFile = path.join(__dirname, "settings.json");

    this.loadSettings();
    this.setupApp();
    this.inActiveTime = 5 * 60 * 1000; // 5min
    // this.inActiveTime = 1 * 60 * 1000; // 1min
    this.inActiveBreakTime = 10 * 1000; // 10sec
    this.isBreakActive = false;
    this.breakAlertTime = null;
    this.breakWindow = null;
  }
  loadSettings() {
    try {
      if (fs.existsSync(this.settingsFile)) {
        const settings = JSON.parse(
          fs.readFileSync(this.settingsFile, "utf-8")
        );
        this.breakThreshold = (settings.breakThresholdMinutes || 30) * 60;
      }
    } catch (error) {
      console.error("Error while loading settings: ", error);
      this.breakThreshold = 30 * 60; // Default 30 minutes
    }
  }
  setupApp() {
    app.whenReady().then(() => {
      const startHidden = process.argv.includes("--hidden");
      this.createWindow();
      // If we started hidden (e.g., system startup), hide the window
      if (startHidden && this.mainWindow) {
        this.mainWindow.hide(); // keep running in tray
      }
      this.createTray();
      this.setupPowerMonitor();
      this.startMonitoring();
      // Enable auto-launch at login
      app.setLoginItemSettings({
        openAtLogin: true, // launch at startup
        path: process.execPath, // app exe
        // args: [], // optional arguments
        args: ["--hidden"], // start app without showing the main window.
      });
    });

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    // IPC handlers
    ipcMain.handle("get-usage-data", () => ({
      usageTime: this.usageTime,
      breakThreshold: this.breakThreshold,
      isMonitoring: this.isMonitoring,
      isBreakTime: this.isBreakTime,
    }));

    ipcMain.handle("toggle-monitoring", () => {
      this.toggleMonitoring();
      return this.isMonitoring;
    });

    ipcMain.handle("reset-timer", () => {
      this.resetTimer();
    });

    ipcMain.handle("save-settings", (event, settings) => {
      this.breakThreshold = settings.breakThresholdMinutes * 60;
      this.saveSettings();
    });

    ipcMain.handle("start-break", () => {
      this.startBreak();
    });

    ipcMain.handle("snooze-break", () => {
      this.snoozeBreak();
    });
    ipcMain.on("close-break-window", () => {
      if (this.breakWindow && !this.breakWindow.isDestroyed()) {
        this.snoozeBreak();
        this.breakWindow.close();
        this.breakWindow = null;
      }
    });
    ipcMain.on("complete-break", () => {
      console.log("break completer");
      if (this.breakWindow && !this.breakWindow.isDestroyed()) {
        console.log("break completed.");
        this.completeBreak();
        this.breakWindow.close();
        this.breakWindow = null;
      }
    });
  }
  completeBreak() {
    this.isBreakActive = false;
    this.isMonitoring = true;
    this.showNotification(`Break Completed! Monitoring start again.`);
    this.resetTimer();
  }
  createTray() {
    this.tray = new Tray(path.join(__dirname, "assets", "tray-icon.png")); // Add your tray icon

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show App",

        click: () => {
          this.mainWindow.show();
        },
      },

      {
        label: "Toggle Monitoring",

        click: () => {
          this.toggleMonitoring();
        },
      },

      {
        label: "Reset Timer",

        click: () => {
          this.resetTimer();
        },
      },

      {
        type: "separator",
      },

      {
        label: "Quit",

        click: () => {
          app.isQuiting = true;

          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);

    this.tray.setToolTip("Screen Time Monitor");

    this.tray.on("double-click", () => {
      this.mainWindow.show();
    });
  }
  resetTimerOnSystemOn() {
    console.log("break active", this.isBreakActive);
    if (
      !this.isBreakActive &&
      this.breakWindow &&
      !this.breakWindow.isDestroyed()
    ) {
      this.breakWindow.close();
      this.breakWindow = null;
    }
    this.resetTimer();
  }
  setupPowerMonitor() {
    // Monitor system events
    powerMonitor.on("suspend", () => {
      console.log("System is going to sleep");
      this.isMonitoring = false;
      this.resetTimerOnSystemOn();
    });

    powerMonitor.on("resume", () => {
      console.log("System resumed from sleep");
      this.resetTimerOnSystemOn();
      this.isBreakActive = false;
      this.isMonitoring = true;
    });

    powerMonitor.on("lock-screen", () => {
      console.log("Screen locked");
      this.isMonitoring = false;
      this.resetTimerOnSystemOn();
    });

    powerMonitor.on("unlock-screen", () => {
      console.log("Screen unlocked");
      this.resetTimerOnSystemOn();
      this.isBreakActive = false;
      this.isMonitoring = true;
    });
  }
  startMonitoring() {
    this.isMonitoring = true;
    this.monitorInterval = setInterval(() => {
      if (this.isMonitoring && !this.isBreakActive) {
        // this.checkSystemActivity().then((isActive) => {
        //   if (isActive) {
        this.usageTime += 1;
        this.lastActivityTime = Date.now();
        // Update renderer
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send("usage-update", {
            usageTime: this.usageTime,
            isMonitoring: this.isMonitoring,
            isBreakTime: this.isBreakTime,
            breakThreshold: this.breakThreshold,
          });
        }
        // Check if break is needed
        if (this.usageTime >= this.breakThreshold && !this.isBreakTime) {
          this.triggerBreakAlert();
        }
        if (
          this.isBreakTime &&
          Date.now() - this.breakAlertTime > this.inActiveBreakTime
        ) {
          //   this.snoozeBreak();
          this.breakWindow?.webContents.send("snooze-break-click");
        }
      } else {
        // Check if system has been inactive for 5 minutes
        if (Date.now() - this.lastActivityTime > this.inActiveTime) {
          //this.resetTimer();
        }
        //   }
        // });
      }
    }, 1000);
  }
  triggerBreakAlert() {
    this.isBreakTime = true;
    this.breakAlertTime = Date.now();
    this.mainWindow.maximize();
    // this.mainWindow.show();

    // Show notification
    this.showNotification(
      `Break Time! You've been using your computer for ${this.formatTime(
        this.usageTime
      )}`
    );

    // Create break alert window
    this.createBreakAlert();

    // Update main window
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("break-alert", {
        usageTime: this.usageTime,
      });
    }
  }

  createBreakAlert() {
    const { height } = screen.getPrimaryDisplay().workAreaSize;
    if (this.breakWindow) return;
    const breakWindow = new BrowserWindow({
      width: 700,
      //   height: 500,
      height: height * 0.8, // take full available height
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
      alwaysOnTop: true, // it shows break alert on top of every app so you have to close or choose break alert option,

      //  otherwise set to false if you don't want break alert always on top
      resizable: false,
      title: "Break Time!",
      parent: this.mainWindow,
      //   modal: true,
    });

    breakWindow.loadFile("break-alert.html");
    breakWindow.setMenu(null); // remove default menu bar
    // Send usage data to break window
    breakWindow.on("closed", () => {
      this.snoozeBreak(); // call your function
      this.breakWindow = null;
    });
    breakWindow.webContents.once("did-finish-load", () => {
      breakWindow.webContents.send("break-data", {
        usageTime: this.usageTime,
        formattedTime: this.formatTime(this.usageTime),
      });
    });
    this.breakWindow = breakWindow;
  }
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  showNotification(message) {
    if (Notification.isSupported()) {
      new Notification({
        title: "Screen Time Monitor",
        body: message,
        icon: path.join(__dirname, "assets", "icon.png"),
      }).show();
    }
  }

  async checkSystemActivity() {
    return new Promise((resolve) => {
      if (process.platform === "win32") {
        // Try the PowerShell approach first
        const simpleCmd = `
          $lastInputInfo = New-Object -TypeName PSObject
          try {
            $code = @'
            [DllImport("user32.dll")]
            public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
            public struct LASTINPUTINFO {
                public uint cbSize;
                public uint dwTime;
            }
'@
            $type = Add-Type -MemberDefinition $code -Name LastInput -PassThru
            $lastInput = New-Object $type+LASTINPUTINFO
            $lastInput.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($lastInput)
            if ($type::GetLastInputInfo([ref]$lastInput)) {
              $idle = [System.Environment]::TickCount - $lastInput.dwTime
              Write-Output $idle
            } else {
              Write-Output "FALLBACK"
            }
          } catch {
            Write-Output "FALLBACK"
          }
        `.replace(/\s+/g, " ");

        exec(
          `powershell -Command "${simpleCmd}"`,
          { timeout: 3000 },
          (error, stdout) => {
            if (error || stdout.trim() === "FALLBACK") {
              // Fallback: Use internal activity tracking
              const timeSinceLastActivity = Date.now() - this.lastUserActivity;
              const isActive = timeSinceLastActivity < this.inActiveTime; // 5 minutes
              resolve(isActive);
            } else {
              const idleTime = parseInt(stdout.trim());
            }
          }
        );
      } else if (process.platform === "darwin") {
        // macOS: Check idle time
        exec(
          "ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print int($NF/1000000000); exit}'",
          (error, stdout) => {
            if (error) {
              resolve(true);
            } else {
              const idleSeconds = parseInt(stdout.trim());
              resolve(idleSeconds < 60); // Active if idle < 1 minute
            }
          }
        );
      } else {
        // Linux: Check idle time using xprintidle if available
        exec("xprintidle", (error, stdout) => {
          if (error) {
            resolve(true); // Assume active if can't check
          } else {
            const idleMs = parseInt(stdout.trim());
            resolve(idleMs < 60000); // Active if idle < 1 minute
          }
        });
      }
    });
  }
  toggleMonitoring() {
    this.isMonitoring = !this.isMonitoring;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("monitoring-toggled", this.isMonitoring);
    }
  }
  resetTimer() {
    this.usageTime = 0;
    this.isBreakTime = false;
    if (fs.existsSync(this.settingsFile)) {
      const settings = JSON.parse(fs.readFileSync(this.settingsFile, "utf-8"));
      this.breakThreshold = (settings.breakThresholdMinutes || 30) * 60;
    }
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("timer-reset");
    }
  }
  saveSettings() {
    const settings = {
      breakThresholdMinutes: this.breakThreshold / 60,
      autoStart: true,
    };
    try {
      fs.writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error("Error while saving settings: ", error);
    }
  }
  startBreak() {
    this.resetTimer();
    this.isBreakTime = false;
    this.isMonitoring = false; // add
    this.isBreakActive = true;
    this.showNotification("Break Started! Timer Reset!");
  }
  snoozeBreak() {
    // this.usageTime -= 5 * 60; // Subtract 5 minutes
    // this.isBreakTime = false;
    if (!this.isBreakTime) return;
    // this.breakThreshold = this.breakThreshold * 2; // break time increase by 2 times if we snooze break;
    this.breakThreshold = this.breakThreshold + 5 * 60; // break time increase with 5 min.
    this.isBreakTime = false;
    this.isBreakActive = false;
    this.isMonitoring = true;
    this.showNotification(
      `Break reminder snoozed for ${parseInt(
        this.breakThreshold / 120
      )} minutes`
    );
    this.mainWindow.maximize();
    // this.mainWindow.show();
  }
  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 500,
      height: 400,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
      icon: path.join(__dirname, "assets", "icon.png"),
      title: "Screen Time Monitor",
    });
    this.mainWindow.loadFile("index.html");
    this.mainWindow.maximize();
    this.mainWindow.on("close", (event) => {
      if (!app.isQuiting) {
        event.preventDefault();
        this.mainWindow.hide();
        this.showNotification("Screen Time Monitor minimized to tray");
      }
    });
    this.mainWindow.setMenu(null);
  }
}

new ScreenTimeMonitor();
