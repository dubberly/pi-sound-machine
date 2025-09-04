// Simple Sound Machine App - Focused on reliability
let appState = {
  isPlaying: false,
  currentSound: null,
  volume: 0.7,
  isPi: false,
  activeTab: 'play',
  timer: {
    isActive: false,
    selectedSound: null,
    stopTime: null
  }
};

let statusInterval = null;
let browserAudio = null;
let userChangingVolume = false; // Track when user is actively changing volume
let timerData = {
  selectedSound: null,
  selectedTime: null
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  
  // Start with Server-Sent Events for real-time sync
  setupServerSentEvents();
  
  // Fallback: Light polling only if SSE fails
  setTimeout(() => {
    if (!window.sseConnected) {
      startLightPolling();
    }
  }, 2000);
  
  // Update timer display every second
  setInterval(updateTimerDisplay, 1000);
});

// Server-Sent Events for real-time sync
function setupServerSentEvents() {
  const eventSource = new EventSource('/api/events');
  
  eventSource.onopen = () => {
    window.sseConnected = true;
    updateConnectionStatus(true);
  };
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      appState = { ...data };
      updateUI();
      updateConnectionStatus(true);
    } catch (error) {
      // Error parsing SSE data
    }
  };
  
  eventSource.onerror = (error) => {
    window.sseConnected = false;
    updateConnectionStatus(false);
  };
  
  window.sseEventSource = eventSource;
}

// Light polling fallback - only if SSE fails
function startLightPolling() {
  statusInterval = setInterval(updateStatus, 5000);
}

// Status update function
async function updateStatus() {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    
    appState = { ...data };
    updateUI();
    updateConnectionStatus();
  } catch (error) {
    updateConnectionStatus(false);
  }
}

// Update UI function
function updateUI() {
  // Update sound buttons (both tabs)
  document.querySelectorAll('.sound-button, .sound-card').forEach(element => {
    const soundType = element.dataset.sound;
    const isActive = appState.isPlaying && appState.currentSound === soundType;
    element.classList.toggle('active', isActive);
    element.classList.toggle('selected', soundType === timerData.selectedSound);
  });
  
  // Update stop button
  const stopBtn = document.getElementById('stopButton');
  if (stopBtn) {
    stopBtn.disabled = !appState.isPlaying;
    stopBtn.classList.toggle('active', appState.isPlaying);
    stopBtn.textContent = appState.isPlaying ? 'Stop Sound' : 'Stop';
  }
  
  // Update timer buttons
  updateTimerButtons();
  
  // Update timer display
  updateTimerDisplay();
  
  // Sync active tab
  syncActiveTab();
  
  // Update status display
  updateStatusDisplay();
  
  // Update volume display if user isn't actively changing it
  updateVolumeDisplayIfNotActive();
}

// Status display update
function updateStatusDisplay() {
  const statusText = document.getElementById('statusText');
  const currentInfo = document.getElementById('currentInfo');
  const statusLight = document.getElementById('statusLight');
  
  if (appState.isPlaying && appState.currentSound) {
    const soundName = getSoundDisplayName(appState.currentSound);
    if (statusText) statusText.textContent = 'Playing';
    if (currentInfo) currentInfo.textContent = `Playing: ${soundName}`;
    if (statusLight) statusLight.className = 'status-light playing';
  } else {
    if (statusText) statusText.textContent = 'Ready';
    if (currentInfo) currentInfo.textContent = 'No sound playing';
    if (statusLight) statusLight.className = 'status-light ready';
  }
}

// Volume display update
function updateVolumeDisplay() {
  const volumePercent = Math.round(appState.volume * 100);
  
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeValue = document.getElementById('volumeValue');
  const timerVolume = document.getElementById('timerVolume');
  const timerVolumeValue = document.getElementById('timerVolumeValue');
  
  if (volumeSlider) volumeSlider.value = volumePercent;
  if (volumeValue) volumeValue.textContent = `${volumePercent}%`;
  if (timerVolume) timerVolume.value = volumePercent;
  if (timerVolumeValue) timerVolumeValue.textContent = `${volumePercent}%`;
}

// Update volume display only if user isn't actively changing it
function updateVolumeDisplayIfNotActive() {
  if (!userChangingVolume) {
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      const displayedVolume = parseInt(volumeSlider.value) / 100;
      const serverVolume = appState.volume;
      
      // Only update if difference is more than 2%
      if (Math.abs(displayedVolume - serverVolume) > 0.02) {
        updateVolumeDisplay();
      }
    } else {
      updateVolumeDisplay();
    }
  }
}

// Connection status update
function updateConnectionStatus(connected = true) {
  const connectionLight = document.getElementById('connectionLight');
  const connectionStatus = document.getElementById('connectionStatus');
  
  if (connectionLight && connectionStatus) {
    if (connected) {
      connectionLight.className = appState.isPi ? 'connection-light connected' : 'connection-light browser';
      connectionStatus.textContent = appState.isPi ? 'Connected to Pi' : 'Browser Mode';
    } else {
      connectionLight.className = 'connection-light error';
      connectionStatus.textContent = 'Connection Error';
    }
  }
}

function getSoundDisplayName(soundType) {
  const names = {
    white: 'White Noise',
    brown: 'Brown Noise',
    pink: 'Pink Noise',
    dryer: 'Dryer Sound',
    ocean: 'Ocean Waves'
  };
  return names[soundType] || soundType;
}

// Timer-related functions
function updateTimerButtons() {
  const startBtn = document.getElementById('startTimerButton');
  const cancelBtn = document.getElementById('cancelTimerButton');
  
  if (startBtn && cancelBtn) {
    const canStart = timerData.selectedSound && timerData.selectedTime;
    const timerActive = appState.timer && appState.timer.isActive;
    
    startBtn.disabled = !canStart || timerActive;
    startBtn.textContent = timerActive ? 'Timer Running' : 'Start Timer';
    
    cancelBtn.disabled = !timerActive;
  }
}

function updateTimerDisplay() {
  const timerDisplay = document.getElementById('timerDisplay');
  const timeRemaining = document.getElementById('timeRemaining');
  
  if (appState.timer && appState.timer.isActive && appState.timer.stopTime) {
    const now = new Date();
    const stopTime = new Date(appState.timer.stopTime);
    const remainingMs = stopTime.getTime() - now.getTime();
    
    if (remainingMs > 0) {
      const hours = Math.floor(remainingMs / 3600000);
      const minutes = Math.floor((remainingMs % 3600000) / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);
      
      let timeText;
      if (hours > 0) {
        timeText = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      
      if (timerDisplay) {
        timerDisplay.textContent = `Playing until alarm: ${timeText}`;
        timerDisplay.style.display = 'block';
      }
    } else {
      if (timerDisplay) timerDisplay.style.display = 'none';
    }
  } else {
    if (timerDisplay) timerDisplay.style.display = 'none';
    
    // Update time remaining display when not active
    if (timeRemaining && timerData.selectedTime) {
      const now = new Date();
      const stopTime = new Date(timerData.selectedTime);
      const remainingMs = stopTime.getTime() - now.getTime();
      
      if (remainingMs > 0) {
        const hours = Math.floor(remainingMs / 3600000);
        const minutes = Math.floor((remainingMs % 3600000) / 60000);
        
        let timeText;
        if (hours > 0) {
          timeText = `${hours} hours, ${minutes} minutes`;
        } else {
          timeText = `${minutes} minutes`;
        }
        timeRemaining.textContent = `Time until alarm: ${timeText}`;
      } else {
        timeRemaining.textContent = 'Time until alarm: calculating...';
      }
    }
  }
}

function syncActiveTab() {
  const currentActiveTab = document.querySelector('.tab-button.active')?.dataset.tab;
  
  if (appState.activeTab && currentActiveTab !== appState.activeTab) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === appState.activeTab);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      if (appState.activeTab === 'play' && content.id === 'playTab') {
        content.classList.add('active');
      } else if (appState.activeTab === 'timer' && content.id === 'timerTab') {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }
}

// Timer control functions
async function startTimer() {
  if (!timerData.selectedSound || !timerData.selectedTime) {
    alert('Please select a sound and stop time');
    return;
  }
  
  const volume = appState.volume;
  const stopTime = timerData.selectedTime;
  
  try {
    const response = await fetch('/api/timer/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sound: timerData.selectedSound, 
        stopTime: stopTime,
        volume: volume
      })
    });
    
    if (response.ok) {
      setTimeout(updateStatus, 50);
    } else {
      const error = await response.json();
      alert('Failed to start timer: ' + (error.error || 'Unknown error'));
    }
  } catch (error) {
    alert('Failed to start timer');
  }
}

async function cancelTimer() {
  try {
    const response = await fetch('/api/timer/cancel', { method: 'POST' });
    
    if (response.ok) {
      setTimeout(updateStatus, 50);
    }
  } catch (error) {
    // Timer cancel failed
  }
}

async function setActiveTab(tabName) {
  try {
    const response = await fetch('/api/tab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tab: tabName })
    });
    
    if (response.ok) {
      setTimeout(updateStatus, 50);
    }
  } catch (error) {
    // Tab change failed
  }
}

// Sound control functions
async function playSound(soundType) {
  try {
    if (appState.isPi) {
      const response = await fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sound: soundType })
      });
      
      if (response.ok) {
        setTimeout(updateStatus, 50);
      }
    } else {
      await playBrowserAudio(soundType);
    }
  } catch (error) {
    // Play failed
  }
}

async function stopSound() {
  try {
    if (appState.isPi) {
      const response = await fetch('/api/stop', { method: 'POST' });
      if (response.ok) {
        setTimeout(updateStatus, 50);
      }
    } else {
      stopBrowserAudio();
    }
  } catch (error) {
    // Stop failed
  }
}

// Volume control
async function changeVolume(volume) {
  try {
    // Update local state immediately for responsive UI
    appState.volume = volume;
    
    if (appState.isPi) {
      const response = await fetch('/api/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume })
      });
      
      if (response.ok) {
        setTimeout(updateStatus, 50);
      }
    } else {
      if (browserAudio) {
        browserAudio.volume = volume;
      }
    }
  } catch (error) {
    // Volume change failed
  }
}

// Browser audio fallback
async function playBrowserAudio(soundType) {
  stopBrowserAudio();
  
  const audioFile = `/audio/${soundType}-noise.mp3`;
  browserAudio = new Audio(audioFile);
  browserAudio.loop = true;
  browserAudio.volume = appState.volume;
  
  try {
    await browserAudio.play();
    appState.isPlaying = true;
    appState.currentSound = soundType;
    updateUI();
  } catch (error) {
    // Browser audio failed
  }
}

function stopBrowserAudio() {
  if (browserAudio) {
    browserAudio.pause();
    browserAudio = null;
  }
  appState.isPlaying = false;
  appState.currentSound = null;
  updateUI();
}

// Event listeners
function setupEventListeners() {
  // Sound buttons (Play tab)
  document.querySelectorAll('.sound-button').forEach(button => {
    button.addEventListener('click', () => {
      const soundType = button.dataset.sound;
      if (appState.isPlaying && appState.currentSound === soundType) {
        stopSound();
      } else {
        playSound(soundType);
      }
    });
  });

  // Sound cards (Timer tab) - ISSUE FIX: No auto-stop when switching tabs
  document.querySelectorAll('.sound-card').forEach(card => {
    card.addEventListener('click', () => {
      const soundType = card.dataset.sound;
      if (appState.isPlaying && appState.currentSound === soundType) {
        stopSound();
      } else {
        playSound(soundType);
      }
    });
  });
  
  // Stop button
  const stopBtn = document.getElementById('stopButton');
  if (stopBtn) {
    stopBtn.addEventListener('click', stopSound);
  }
  
  // ISSUE FIX: Enhanced volume controls with better debouncing
  const volumeSlider = document.getElementById('volumeSlider');
  if (volumeSlider) {
    let volumeTimeout = null;
    
    volumeSlider.addEventListener('input', (e) => {
      userChangingVolume = true;
      const volume = parseInt(e.target.value) / 100;
      const volumeValue = document.getElementById('volumeValue');
      if (volumeValue) volumeValue.textContent = `${e.target.value}%`;
      
      // Update local state immediately for responsive UI
      appState.volume = volume;
      
      // Clear any existing timeout
      if (volumeTimeout) clearTimeout(volumeTimeout);
      
      // Debounce the server request
      volumeTimeout = setTimeout(() => {
        changeVolume(volume);
        setTimeout(() => userChangingVolume = false, 100);
      }, 250);
    });
    
    volumeSlider.addEventListener('mousedown', () => {
      userChangingVolume = true;
    });
    
    volumeSlider.addEventListener('mouseup', () => {
      setTimeout(() => userChangingVolume = false, 600);
    });
    
    // Handle touch events for mobile
    volumeSlider.addEventListener('touchstart', () => {
      userChangingVolume = true;
    });
    
    volumeSlider.addEventListener('touchend', () => {
      setTimeout(() => userChangingVolume = false, 600);
    });
  }
  
  const timerVolumeSlider = document.getElementById('timerVolume');
  if (timerVolumeSlider) {
    let timerVolumeTimeout = null;
    
    timerVolumeSlider.addEventListener('input', (e) => {
      userChangingVolume = true;
      const volume = parseInt(e.target.value) / 100;
      const timerVolumeValue = document.getElementById('timerVolumeValue');
      if (timerVolumeValue) timerVolumeValue.textContent = `${e.target.value}%`;
      
      // Sync with main volume slider immediately
      const volumeSlider = document.getElementById('volumeSlider');
      const volumeValue = document.getElementById('volumeValue');
      if (volumeSlider) volumeSlider.value = e.target.value;
      if (volumeValue) volumeValue.textContent = `${e.target.value}%`;
      
      // Update local state immediately for responsive UI
      appState.volume = volume;
      
      // Clear any existing timeout
      if (timerVolumeTimeout) clearTimeout(timerVolumeTimeout);
      
      // Debounce the server request
      timerVolumeTimeout = setTimeout(() => {
        changeVolume(volume);
        setTimeout(() => userChangingVolume = false, 100);
      }, 250);
    });
    
    timerVolumeSlider.addEventListener('mousedown', () => {
      userChangingVolume = true;
    });
    
    timerVolumeSlider.addEventListener('mouseup', () => {
      setTimeout(() => userChangingVolume = false, 600);
    });
    
    // Handle touch events for mobile
    timerVolumeSlider.addEventListener('touchstart', () => {
      userChangingVolume = true;
    });
    
    timerVolumeSlider.addEventListener('touchend', () => {
      setTimeout(() => userChangingVolume = false, 600);
    });
  }
  
  // Tab switching with server sync
function switchTab(tabName) {
  setActiveTab(tabName);
}
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      switchTab(targetTab);
    });
  });
  
  // Timer functionality
  setupTimerEventListeners();
}

function setupTimerEventListeners() {
  // Sound selection for timer
  document.querySelectorAll('.sound-card').forEach(card => {
    card.addEventListener('click', () => {
      const soundType = card.dataset.sound;
      
      // Clear previous selection
      document.querySelectorAll('.sound-card').forEach(c => c.classList.remove('selected'));
      
      // Select this card
      card.classList.add('selected');
      timerData.selectedSound = soundType;
      
      updateTimerButtons();
    });
  });
  
  // Alarm time input
  const alarmTimeInput = document.getElementById('alarmTime');
  
  if (alarmTimeInput) {
    // Set default time to 8:00 AM
    const now = new Date();
    const defaultAlarmTime = new Date();
    defaultAlarmTime.setHours(8, 0, 0, 0);
    
    // If 8 AM has already passed today, set it for tomorrow
    if (defaultAlarmTime <= now) {
      defaultAlarmTime.setDate(defaultAlarmTime.getDate() + 1);
    }
    
    // Set the input value to the default time
    const timeString = defaultAlarmTime.toTimeString().slice(0, 5);
    alarmTimeInput.value = timeString;
    
    // Set the initial selected time
    timerData.selectedTime = defaultAlarmTime.toISOString();
    
    // Listen for changes
    alarmTimeInput.addEventListener('change', (e) => {
      const timeValue = e.target.value;
      if (timeValue) {
        const now = new Date();
        const [hours, minutes] = timeValue.split(':').map(Number);
        const alarmTime = new Date();
        alarmTime.setHours(hours, minutes, 0, 0);
        
        // If the time is earlier than now, assume it's for tomorrow
        if (alarmTime <= now) {
          alarmTime.setDate(alarmTime.getDate() + 1);
        }
        
        timerData.selectedTime = alarmTime.toISOString();
        updateTimerButtons();
        updateTimerDisplay();
      }
    });
    
    // Initial update
    updateTimerButtons();
    updateTimerDisplay();
  }
  
  // Timer control buttons
  const startBtn = document.getElementById('startTimerButton');
  const cancelBtn = document.getElementById('cancelTimerButton');
  
  if (startBtn) {
    startBtn.addEventListener('click', startTimer);
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', cancelTimer);
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (statusInterval) {
    clearInterval(statusInterval);
  }
  if (window.sseEventSource) {
    window.sseEventSource.close();
  }
  if (browserAudio) {
    browserAudio.pause();
  }
});