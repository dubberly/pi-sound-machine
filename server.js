const express = require('express');
const path = require('path');
const { spawn, exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple global state
let appState = {
  isPlaying: false,
  currentSound: null,
  volume: 0.7,
  activeTab: 'play', // Track which tab is active
  timer: {
    isActive: false,
    selectedSound: null,
    stopTime: null,
    timeoutId: null
  }
};

let currentAudioProcess = null;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Check if we're running on Pi
const IS_PI = (() => {
  try {
    require('fs').accessSync('/proc/asound/cards');
    return true;
  } catch {
    return false;
  }
})();

// Kill all orphaned audio processes
const killAllAudio = () => {
  return new Promise((resolve) => {
    const currentPid = currentAudioProcess ? currentAudioProcess.pid : null;
    
    exec('pgrep -f mpg123', (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve();
        return;
      }
      
      const pids = stdout.trim().split('\n').filter(pid => {
        const pidNum = parseInt(pid);
        return pidNum && pidNum !== currentPid;
      });
      
      if (pids.length > 0) {
        exec(`kill ${pids.join(' ')}`, () => {
          setTimeout(resolve, 100);
        });
      } else {
        resolve();
      }
    });
  });
};

// Set system volume using ALSA mixer
const setSystemVolume = (volumePercent) => {
  return new Promise((resolve) => {
    if (!IS_PI) {
      resolve(false);
      return;
    }
    
    const controls = ['PCM', 'Master', 'Digital', 'Speaker', 'Headphone'];
    let controlIndex = 0;
    
    const tryNextControl = () => {
      if (controlIndex >= controls.length) {
        resolve(false);
        return;
      }
      
      const control = controls[controlIndex];
      exec(`amixer -c 0 sset ${control} ${volumePercent}%`, (error) => {
        if (error) {
          controlIndex++;
          tryNextControl();
        } else {
          resolve(true);
        }
      });
    };
    
    tryNextControl();
  });
};

// Stop audio function
const stopAudio = async (killAll = true) => {
  if (currentAudioProcess) {
    try {
      currentAudioProcess.kill('SIGTERM');
      currentAudioProcess = null;
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      // Process cleanup error - continue
    }
  }
  
  if (killAll) {
    await killAllAudio();
  }
  
  appState.isPlaying = false;
  appState.currentSound = null;
};

// Check if audio process is running
const checkAudioProcessHealth = () => {
  if (appState.isPlaying && currentAudioProcess) {
    try {
      process.kill(currentAudioProcess.pid, 0);
      return true;
    } catch (error) {
      appState.isPlaying = false;
      appState.currentSound = null;
      currentAudioProcess = null;
      return false;
    }
  }
  return appState.isPlaying;
};

// Start audio function
const startAudio = async (soundType) => {
  if (!IS_PI) {
    return false;
  }
  
  try {
    await stopAudio(false);
    
    const audioFiles = {
      white: path.join(__dirname, 'public/audio/white-noise.mp3'),
      brown: path.join(__dirname, 'public/audio/brown-noise.mp3'),
      pink: path.join(__dirname, 'public/audio/pink-noise.mp3'),
      dryer: path.join(__dirname, 'public/audio/dryer-noise.mp3'),
      ocean: path.join(__dirname, 'public/audio/ocean-noise.mp3')
    };

    const audioFile = audioFiles[soundType];
    
    if (!audioFile) {
      throw new Error(`Unknown sound: ${soundType}`);
    }

    // Verify file exists
    try {
      const fs = require('fs');
      fs.accessSync(audioFile, fs.constants.F_OK);
    } catch (err) {
      throw new Error(`Audio file not found: ${audioFile}`);
    }

    // Start mpg123 process
    const scaleValue = 32768;
    
    currentAudioProcess = spawn('mpg123', [
      '-o', 'alsa',
      '--loop', '-1',
      '-f', scaleValue.toString(),
      '-q',
      audioFile
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    currentAudioProcess.on('error', (error) => {
      appState.isPlaying = false;
      appState.currentSound = null;
      currentAudioProcess = null;
    });
    
    currentAudioProcess.on('exit', (code, signal) => {
      if (signal !== 'SIGTERM' && signal !== 'SIGKILL') {
        appState.isPlaying = false;
        appState.currentSound = null;
        currentAudioProcess = null;
      }
    });

    appState.isPlaying = true;
    appState.currentSound = soundType;
    
    return true;
    
  } catch (error) {
    appState.isPlaying = false;
    appState.currentSound = null;
    currentAudioProcess = null;
    throw error;
  }
};

// Server-Sent Events for real-time sync
const clients = new Set();

// SSE endpoint for real-time updates
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  clients.add(res);

  // Send initial state
  const cleanState = {
    ...appState,
    timer: {
      isActive: appState.timer.isActive,
      selectedSound: appState.timer.selectedSound,
      stopTime: appState.timer.stopTime
    },
    isPi: IS_PI
  };
  res.write(`data: ${JSON.stringify(cleanState)}\n\n`);

  // Remove client when connection closes
  req.on('close', () => {
    clients.delete(res);
  });
});

// Function to broadcast state changes to all connected clients
const broadcastStateChange = () => {
  if (clients.size === 0) return;
  
  const cleanState = {
    ...appState,
    timer: {
      isActive: appState.timer.isActive,
      selectedSound: appState.timer.selectedSound,
      stopTime: appState.timer.stopTime
    },
    isPi: IS_PI
  };
  
  const data = `data: ${JSON.stringify(cleanState)}\n\n`;
  
  // Send to all connected clients
  clients.forEach(client => {
    try {
      client.write(data);
    } catch (error) {
      // Remove client if write fails
      clients.delete(client);
    }
  });
};

// API Routes
app.get('/api/status', (req, res) => {
  // Check if our tracked process is actually running
  checkAudioProcessHealth();
  
  // Create a clean copy of the app state for JSON serialization
  const cleanState = {
    ...appState,
    timer: {
      isActive: appState.timer.isActive,
      selectedSound: appState.timer.selectedSound,
      stopTime: appState.timer.stopTime
      // Exclude timeoutId to avoid circular reference
    },
    isPi: IS_PI
  };
  
  res.json(cleanState);
});

app.post('/api/tab', async (req, res) => {
  const { tab } = req.body;
  
  if (tab === 'play' || tab === 'timer') {
    const previousTab = appState.activeTab;
    appState.activeTab = tab;
    
    // If switching TO timer tab, stop current audio
    if (tab === 'timer' && previousTab === 'play' && appState.isPlaying) {
      await stopAudio();
    }
    
    broadcastStateChange();
    res.json({ success: true, activeTab: appState.activeTab });
  } else {
    res.status(400).json({ success: false, error: 'Invalid tab' });
  }
});

// Start timer endpoint
app.post('/api/timer/start', async (req, res) => {
  const { sound, stopTime, volume } = req.body;

  try {
    // Clear any existing timer
    if (appState.timer.timeoutId) {
      clearTimeout(appState.timer.timeoutId);
    }
    
    // Set volume if provided
    if (volume !== undefined) {
      appState.volume = Math.max(0, Math.min(1, volume));
      await setSystemVolume(Math.round(appState.volume * 100));
    }
    
    // Calculate timeout duration
    const now = new Date();
    const stopDate = new Date(stopTime);
    const timeoutMs = stopDate.getTime() - now.getTime();
    
    if (timeoutMs <= 1000) {
      return res.status(400).json({ 
        success: false, 
        error: `Stop time must be in the future. Current: ${now.toISOString()}, Requested: ${stopDate.toISOString()}` 
      });
    }
    
    // Set timer
    appState.timer = {
      isActive: true,
      selectedSound: sound,
      stopTime: stopTime,
      timeoutId: setTimeout(async () => {
        await stopAudio();
        appState.timer.isActive = false;
        appState.timer.timeoutId = null;
        broadcastStateChange();
      }, timeoutMs)
    };
    
    // Start playing the sound immediately
    if (IS_PI) {
      try {
        const playSuccess = await startAudio(sound);
        if (!playSuccess) {
          clearTimeout(appState.timer.timeoutId);
          appState.timer.isActive = false;
          appState.timer.timeoutId = null;
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to start audio for timer' 
          });
        }
      } catch (audioError) {
        clearTimeout(appState.timer.timeoutId);
        appState.timer.isActive = false;
        appState.timer.timeoutId = null;
        return res.status(500).json({ 
          success: false, 
          error: `Failed to start audio for timer: ${audioError.message}` 
        });
      }
    }
    
    // Switch to timer tab
    appState.activeTab = 'timer';
    broadcastStateChange();
    
    res.json({ 
      success: true, 
      timer: {
        sound,
        stopTime,
        durationMinutes: Math.round(timeoutMs/1000/60)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel timer endpoint
app.post('/api/timer/cancel', async (req, res) => {
  try {
    // Clear timer
    if (appState.timer.timeoutId) {
      clearTimeout(appState.timer.timeoutId);
    }
    
    // Stop audio
    await stopAudio();
    
    // Reset timer state
    appState.timer = {
      isActive: false,
      selectedSound: null,
      stopTime: null,
      timeoutId: null
    };
    
    broadcastStateChange();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/play', async (req, res) => {
  const { sound } = req.body;
  
  if (!IS_PI) {
    return res.json({ success: false, message: 'Pi only', clientMode: true });
  }

  try {
    await startAudio(sound);
    broadcastStateChange();
    res.json({ success: true, playing: sound });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/stop', async (req, res) => {
  if (!IS_PI) {
    return res.json({ success: false, message: 'Pi only', clientMode: true });
  }

  try {
    await stopAudio();
    broadcastStateChange();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/volume', async (req, res) => {
  const { volume } = req.body;
  
  if (!IS_PI) {
    return res.json({ success: false, message: 'Pi only', clientMode: true });
  }

  try {
    appState.volume = Math.max(0, Math.min(1, volume));
    const volumePercent = Math.round(appState.volume * 100);
    
    // Set system volume using ALSA mixer
    const systemVolumeSet = await setSystemVolume(volumePercent);
    
    broadcastStateChange();
    
    res.json({ 
      success: true, 
      volume: appState.volume,
      systemVolumeSet
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cleanup on exit
process.on('SIGINT', async () => {
  await stopAudio();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopAudio();
  process.exit(0);
});

// Start server
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sound Machine running on http://0.0.0.0:${PORT}`);
  console.log(`Mode: ${IS_PI ? 'Pi' : 'Development'}`);
});