// break-renderer.js - Break alert window renderer
class BreakAlert {
  constructor() {
    this.breakDuration = 5 * 60; // 5 minutes break
    this.remainingTime = this.breakDuration;
    this.breakTimer = null;
    this.isBreakActive = false;

    this.initializeElements();
    this.setupEventListeners();
    this.loadBreakData();
  }

  initializeElements() {
    this.elements = {
      usageTime: document.getElementById("usageTime"),
      startBreakBtn: document.getElementById("startBreakBtn"),
      snoozeBtn: document.getElementById("snoozeBtn"),
      breakTimer: document.getElementById("breakTimer"),
      breakTimeLeft: document.getElementById("breakTimeLeft"),
      breakProgressFill: document.getElementById("breakProgressFill"),
    };
  }

  setupEventListeners() {
    // Button event listeners
    this.elements.startBreakBtn.addEventListener("click", () => {
      this.startBreak();
    });

    this.elements.snoozeBtn.addEventListener("click", () => {
      this.snoozeBreak();
    });

    // Listen for break data from main process
    window.electronAPI.onBreakData((event, data) => {
      this.displayBreakData(data);
    });
    // Listen for snooze break event
    window.electronAPI.onSnoozeBreak((event, data) => {
      this.onSnoozeBreak();
    });

    // Handle window close
    window.addEventListener("beforeunload", () => {
      this.cleanup();
    });

    // Add keyboard shortcuts
    document.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        this.startBreak();
      } else if (event.key === "Escape") {
        this.snoozeBreak();
      }
    });
  }

  loadBreakData() {
    // Data will be sent via IPC when window loads
    // This is a fallback in case IPC data doesn't arrive
    setTimeout(() => {
      if (
        !this.elements.usageTime.textContent ||
        this.elements.usageTime.textContent === "--:--:--"
      ) {
        this.elements.usageTime.textContent = "30:00+";
      }
    }, 1000);
  }

  displayBreakData(data) {
    this.elements.usageTime.textContent = data.formattedTime;

    // Add some visual flair based on usage time
    if (data.usageTime > 3600) {
      // More than 1 hour
      this.elements.usageTime.style.color = "#dc2626";
      this.elements.usageTime.style.fontWeight = "bold";
    } else if (data.usageTime > 1800) {
      // More than 30 minutes
      this.elements.usageTime.style.color = "#f59e0b";
    }
  }
  onSnoozeBreak() {
    this.snoozeBreak();
  }

  async startBreak() {
    try {
      // Show break timer
      this.showBreakTimer();

      // Notify main process
      await window.electronAPI.startBreak();

      // Start the break countdown
      this.startBreakCountdown();
    } catch (error) {
      console.error("Error starting break:", error);
    }
  }

  async snoozeBreak() {
    try {
      await window.electronAPI.snoozeBreak();
      this.closeWindow();
    } catch (error) {
      console.error("Error snoozing break:", error);
    }
  }

  showBreakTimer() {
    // Hide the main break content
    document.querySelector(".break-suggestions").style.display = "none";
    document.querySelector(".break-actions").style.display = "none";

    // Show the break timer
    this.elements.breakTimer.style.display = "block";

    // Update header message
    document.querySelector(".break-message").innerHTML =
      'Great! Taking a <span style="color: #059669;">5-minute break</span>. Relax and recharge!';
  }

  startBreakCountdown() {
    this.isBreakActive = true;
    this.remainingTime = this.breakDuration;

    this.breakTimer = setInterval(() => {
      this.remainingTime--;
      this.updateBreakDisplay();

      if (this.remainingTime <= 0) {
        this.completeBreak();
      }
    }, 1000);

    // Add encouraging messages at intervals
    this.scheduleEncouragingMessages();
  }

  updateBreakDisplay() {
    const minutes = Math.floor(this.remainingTime / 60);
    const seconds = this.remainingTime % 60;
    this.elements.breakTimeLeft.textContent = `${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    // Update progress bar (reverse progress for break)
    const progress =
      ((this.breakDuration - this.remainingTime) / this.breakDuration) * 100;
    this.elements.breakProgressFill.style.width = `${progress}%`;
  }

  scheduleEncouragingMessages() {
    // Show encouraging messages during break
    const messages = [
      "Great job taking care of yourself! 👏",
      "Your eyes will thank you for this break! 👀",
      "Keep up the healthy habits! 💚",
      "Almost there! You're doing great! 🌟",
    ];

    setTimeout(() => {
      if (this.isBreakActive) this.showEncouragement(messages[0]);
    }, 1000);

    setTimeout(() => {
      if (this.isBreakActive) this.showEncouragement(messages[1]);
    }, 90000); // 1.5 minutes

    setTimeout(() => {
      if (this.isBreakActive) this.showEncouragement(messages[2]);
    }, 180000); // 3 minutes

    setTimeout(() => {
      if (this.isBreakActive) this.showEncouragement(messages[3]);
    }, 240000); // 4 minutes
  }

  showEncouragement(message) {
    const tipElement = document.querySelector(".break-tip p");
    const originalText = tipElement.innerHTML;

    tipElement.innerHTML = `<strong>💫 ${message}</strong>`;
    tipElement.style.color = "#059669";

    setTimeout(() => {
      tipElement.innerHTML = originalText;
      tipElement.style.color = "";
    }, 3000);
  }

  completeBreak() {
    this.cleanup();

    // Show completion message
    document.querySelector(".break-header h2").textContent =
      "🎉 Break Complete!";
    document.querySelector(".break-message").innerHTML =
      'Well done! You\'ve completed your break. <span style="color: #059669;">Timer has been reset</span>.';

    this.elements.breakTimer.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p style="color: #059669; font-size: 18px; margin-bottom: 15px;">✅ Break completed successfully!</p>
               <button id="returnWorkBtn" class="btn primary" style="padding: 10px 20px;">
                 Return to Work
            </button>
            </div>
        `;
    document.getElementById("returnWorkBtn").addEventListener("click", () => {
      this.completeBreakTrigger();
    });

    // Auto-close after 3 seconds
  }
  async completeBreakTrigger() {
    // setTimeout(() => {
    await window.electronAPI.completeBreak(); // tell main process to close only break window
    // }, 3000);
  }

  cleanup() {
    if (this.breakTimer) {
      clearInterval(this.breakTimer);
      this.breakTimer = null;
    }
    this.isBreakActive = false;
  }

  closeWindow() {
    this.cleanup();
    // window.close();
    window.electronAPI.closeBreakWindow(); // tell main process to close only break window
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new BreakAlert();
});

// Handle window unload
window.addEventListener("beforeunload", () => {
  // Clean up any running timers
  if (window.breakAlert) {
    window.breakAlert.cleanup();
  }
});

// Make BreakAlert globally accessible for cleanup
window.breakAlert = null;
document.addEventListener("DOMContentLoaded", () => {
  window.breakAlert = new BreakAlert();
});
