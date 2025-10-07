const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Get usage data
  getUsageData: () => ipcRenderer.invoke("get-usage-data"),

  // Control functions
  toggleMonitoring: () => ipcRenderer.invoke("toggle-monitoring"),
  resetTimer: () => ipcRenderer.invoke("reset-timer"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),

  // Break functions
  startBreak: () => ipcRenderer.invoke("start-break"),
  snoozeBreak: () => ipcRenderer.invoke("snooze-break"),

  // Event listeners
  onUsageUpdate: (callback) => ipcRenderer.on("usage-update", callback),
  onBreakAlert: (callback) => ipcRenderer.on("break-alert", callback),
  onTimerReset: (callback) => ipcRenderer.on("timer-reset", callback),
  onMonitoringToggled: (callback) =>
    ipcRenderer.on("monitoring-toggled", callback),
  onBreakData: (callback) => ipcRenderer.on("break-data", callback),
  onSnoozeBreak: (callback) => ipcRenderer.on("snooze-break-click", callback),
  closeBreakWindow: () => ipcRenderer.send("close-break-window"),
  completeBreak: () => ipcRenderer.send("complete-break"),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
