class ScreenTimeUI {
  constructor() {
    this.usageTime = 0;
    this.breakThreshold = 30 * 60; // 30 minutes in seconds
    this.isMonitoring = false;
    this.defaultBreakThreshold = 30 * 60;
    this.isBreakTime = false;

    this.initializeElements();
    this.setupEventListeners();
    this.loadInitialData();
  }
  initializeElements() {
    this.elements = {
      timeDisplay: document.getElementById("timeDisplay"),
      progressFill: document.getElementById("progressFill"),
      progressText: document.getElementById("progressText"),
      status: document.getElementById("status"),
      toggleBtn: document.getElementById("toggleBtn"),
      resetBtn: document.getElementById("resetBtn"),
      saveBtn: document.getElementById("saveBtn"),
      breakThreshold: document.getElementById("breakThreshold"),
    };
  }
  setupEventListeners() {
    // Button event listeners
    this.elements.toggleBtn.addEventListener("click", () => {
      this.toggleMonitoring();
    });

    this.elements.resetBtn.addEventListener("click", () => {
      this.resetTimer();
    });

    this.elements.saveBtn.addEventListener("click", () => {
      this.saveSettings();
    });

    // IPC event listeners
    window.electronAPI.onUsageUpdate((event, data) => {
      this.updateUsageData(data);
    });

    window.electronAPI.onBreakAlert((event, data) => {
      this.handleBreakAlert(data);
    });

    window.electronAPI.onTimerReset(() => {
      this.handleTimerReset();
    });

    window.electronAPI.onMonitoringToggled((event, isMonitoring) => {
      this.updateMonitoringState(isMonitoring);
    });
  }
  async saveSettings() {
    try {
      const breakThresholdMinutes = parseInt(
        this.elements.breakThreshold.value
      );
      if (breakThresholdMinutes < 0 || breakThresholdMinutes > 120) {
        alert("Please enter a value between 15 and 120 minutes.");
        return;
      }
      await this.resetTimer();
      await window.electronAPI.saveSettings({
        breakThresholdMinutes: breakThresholdMinutes,
      });
      this.breakThreshold = breakThresholdMinutes * 60;
      this.defaultBreakThreshold = this.breakThreshold;
      this.updateDisplay();
      this.showSuccessMessage();
    } catch (error) {
      console.error("Error while save settings : ", error);
      alert("Error in saving settings. please try again.");
    }
  }
  async resetTimer() {
    try {
      await window.electronAPI.resetTimer();
      this.handleTimerReset();
    } catch (error) {
      console.error("Error resetting timer: ", error);
    }
  }
  showSuccessMessage() {
    const originalText = this.elements.saveBtn.textContent;
    this.elements.saveBtn.textContent = "✅ Saved!";
    this.elements.saveBtn.style.background =
      "linear-gradient(45deg, #10b981, #059669)";
    setTimeout(() => {
      this.elements.saveBtn.textContent = originalText;
      this.elements.saveBtn.style.background = "";
    }, 2000);
  }
  async toggleMonitoring() {
    try {
      const newState = await window.electronAPI.toggleMonitoring();
      this.updateMonitoringState(newState);
    } catch (error) {
      console.error("Error while toggling monitoring: ", error);
    }
  }
  updateUsageData(data) {
    this.usageTime = data.usageTime;
    this.isMonitoring = data.isMonitoring;
    this.breakThreshold = data.breakThreshold;
    this.isBreakTime = data.isBreakTime;
    // this.elements.breakThreshold.value = Math.floor(data.breakThreshold / 60);
    this.updateDisplay();

    if (data.isBreakTime) {
      this.updateStatus("Status : Break Time!");
    } else if (data.isMonitoring) {
      this.updateStatus("Status : Monitoring");
    } else {
      this.updateStatus("Status: Paused");
    }
  }
  handleBreakAlert() {
    this.updateStatus("Status: Break Alert Shown");
    // The break alert window will be shown by the main process
  }
  handleTimerReset() {
    this.usageTime = 0;
    this.updateDisplay();
    this.updateStatus("Status: Timer Reset");
  }
  async loadInitialData() {
    try {
      const data = await window.electronAPI.getUsageData();
      this.usageTime = data.usageTime;
      this.breakThreshold = data.breakThreshold;
      this.defaultBreakThreshold = this.breakThreshold;
      this.isMonitoring = data.isMonitoring;
      this.elements.breakThreshold.value = Math.floor(data.breakThreshold / 60);
      this.updateDisplay();
      this.updateMonitoringState(this.isMonitoring);
    } catch (error) {
      this.updateStatus("Error while loading data.");
    }
  }
  updateDisplay() {
    // update time display
    this.elements.timeDisplay.textContent = this.format(this.usageTime);
    // update progress bar
    const progress = Math.min(
      (this.usageTime / this.breakThreshold) * 100,
      100
    );

    this.elements.progressFill.style.width = `${progress}%`;

    // update progress text
    const remainingMinutes = Math.max(
      0,
      Math.ceil((this.breakThreshold - this.usageTime) / 60)
    );
    if (!this.isBreakTime && this.breakThreshold > this.defaultBreakThreshold) {
      this.elements.progressText.textContent = `${remainingMinutes} min until snooze break (${parseInt(
        this.breakThreshold / 60
      )}min), Break Needed!`;
      this.elements.progressFill.style.background =
        "linear-gradient(90deg, #ef4444, #dc2626)";
    } else if (this.usageTime >= this.breakThreshold) {
      this.elements.progressText.textContent = "Break time!";
      this.elements.progressFill.style.background =
        "linear-gradient(90deg, #ef4444, #dc2626)";
    } else {
      this.elements.progressText.textContent = `${remainingMinutes} min until break`;
      this.elements.progressFill.style.background =
        "linear-gradient(90deg, #10b981, #059669)";
    }
  }
  updateMonitoringState(isMonitoring) {
    this.isMonitoring = isMonitoring;
    this.elements.toggleBtn.textContent = isMonitoring
      ? "Pause Monitoring"
      : "Start Monitoring";
    this.updateStatus(isMonitoring ? "Status: Monitoring" : "Status: Paused");
  }
  updateStatus(message) {
    this.elements.status.textContent = message;
  }
  format(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const sec = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  }
}
// Initialize the UI when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ScreenTimeUI();
});
