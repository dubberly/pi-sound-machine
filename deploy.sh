#!/bin/bash

# Deploy to Raspberry Pi
PI_HOST="slade@10.1.40.62"
PI_PATH="~/raspberry-pi-sound-machine"

echo "🚀 Deploying Raspberry Pi Sound Machine..."

# Copy files to Pi (excluding node_modules and .git)
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '*.log' \
  ./ ${PI_HOST}:${PI_PATH}/

if [ $? -eq 0 ]; then
    echo "✅ Files copied successfully"
    
    echo "🔄 Restarting Sound Machine on Pi..."
    ssh ${PI_HOST} "cd ${PI_PATH} && chmod +x soundmachine.sh && ./soundmachine.sh restart"
    
    echo "🎵 Sound Machine deployed and restarted!"
    echo "🌐 Access at: http://10.1.40.62:3000"
else
    echo "❌ Deployment failed"
    exit 1
fi
