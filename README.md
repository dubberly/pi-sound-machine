# Raspberry Pi Sound Machine

A web-based sound machine app designed specifically for **Raspberry Pi Zero 2W and the adafruit speaker bonnet**. I use **2x 4-ohm 3W speakers**, but you could use a single 8ohm 3w speaker. The web app is a clean, mobile-responsive ui with real-time audio control and sleep timer functionality (which my fiance specifically asked for).


![Hardware](https://img.shields.io/badge/Hardware-Raspberry%20Pi%20Zero%202W-green)


## Features

- **6 Sleep Sounds**: White Noise, Brown Noise, Pink Noise, Dryer Sound, Ocean Waves, Panic (and you can add more)
- **Real-time Volume Control**: Hardware ALSA mixer integration
- **Sleep Timer**: Set alarm times with automatic stop functionality
- **Modern Web Interface**: Mobile-responsive design with dark theme (might add more themes)
- **Server-Sent Events**: Real-time synchronization across multiple devices
- **Browser Fallback**: Works in development mode without Pi hardware for testing
- **Auto-start Support**: Systemd service integration for boot startup

## Hardware Requirements

### Required Components
- **Raspberry Pi Zero 2W**
- **2x 4-ohm 3W speakers**
- **Audio amplifier/HAT** (e.g., Adafruit Speaker Bonnet, HiFiBerry, or similar)
- **MicroSD card**
- **Power supply** (5V, 2.5A recommended for stable audio performance)
- **Network connection** (WiFi or Ethernet via USB adapter)

### Audio Setup
The application is optimized for a **stereo speaker setup** using 2x 4-ohm 3W speakers. These provide excellent audio quality while remaining within the power constraints of the Pi Zero 2W.

## Installation

### 1. Get the Raspberry Pi ready (assumes you already put the **32bit** Raspi Lite OS on an SD card)

```bash
# Update the pi
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install audio dependencies
sudo apt install alsa-utils mpg123 -y

# Verify installations
node --version
npm --version
mpg123 --version
```

### 2. Configure the audio bonnet (or whatever you used)

#### For Adafruit Speaker Bonnet:
```bash
# Install bonnet drivers
curl -sS https://get.adafruit.com/downloads/get-speakerbonnet.py | sudo python3

# Test audio output
speaker-test -c 2 -t wav -l 1
```


### 3. Install Sound Machine

```bash
# create the sound machine directory
mkdir sound-machine

# go into the directory you made
cd sound-machine

# clone the repository
git clone https://github.com/dubberly/pi-sound-machine.git

# Install dependencies
npm install

# Make scripts executable
chmod +x soundmachine.sh deploy.sh
```

### 4. Configure Audio Levels

```bash
# Open ALSA mixer
alsamixer

# Or set via command line
amixer sset PCM 80%      # Set PCM level to 80%
amixer sset Master 90%   # Set Master level to 90%
```

## 🚀 Usage

### Development Mode
```bash
# Run locally for development/testing
npm start
# Access at: http://localhost:3000
```

### Production on Raspberry Pi
```bash
# Start the server
./soundmachine.sh start

# Check status
./soundmachine.sh status

# View logs
./soundmachine.sh logs

# Stop the server
./soundmachine.sh stop
```

### Remote Access
Once running on your Pi, access the interface from any device on your network:
```
http://YOUR_PI_IP_ADDRESS:3000
```

## Auto-Start Configuration

To automatically start the sound machine when your Pi boots:

### 1. Create Systemd Service
```bash
sudo nano /etc/systemd/system/sound-machine.service
```

### 2. Add Service Configuration
```ini
[Unit]
Description=Pi Sound Machine
After=network.target sound.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/USERNAME/sound-machine
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Environment variables
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### 3. Enable and Start Service
```bash
# Reload systemd configuration
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable sound-machine.service

# Start the service
sudo systemctl start sound-machine.service

# Check service status
sudo systemctl status sound-machine.service
```

## Audio Configuration

### Optimal Settings for 4Ω 3W Speakers

**ALSA Mixer Settings:**
- **PCM**: 75-85% (digital volume control)
- **Master**: 85-95% (analog output level)
- **Speaker/Headphone**: 80-90% (if available)

**Power Considerations:**
- 2x 3W speakers = 6W total audio power
- Pi Zero 2W can handle this load with proper power supply
- Use 5V 2.5A+ power supply for stable performance

### Audio Quality Optimization

```bash
# Set audio buffer size for smooth playback
echo 'pcm.!default {
    type hw
    card 0
    device 0
    rate 44100
    channels 2
    format S16_LE
}' | sudo tee -a /etc/asound.conf
```

## Project Structure

```
raspberry-pi-sound-machine/
├── server.js
├── package.json
├── soundmachine.sh        # Pi management script
├── deploy.sh              # Deployment script
├── README.md
└── public/
    ├── index.html
    ├── app.js            # Client-side JavaScript
    ├── styles.css
    └── audio/            # Audio files (MP3 format)
        ├── white-noise.mp3
        ├── brown-noise.mp3
        ├── pink-noise.mp3
        ├── dryer-noise.mp3
        └── ocean-noise.mp3
```

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Test in browser mode at http://localhost:3000
```

### Deployment to Pi
```bash
# Deploy from development machine
./deploy.sh

# The script will:
# - Copy files to Pi via rsync
# - Restart the service
# - Confirm deployment
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review existing GitHub issues
3. Create a new issue with detailed information

---

**Built with ❤️ for Haley (my fiance)**
