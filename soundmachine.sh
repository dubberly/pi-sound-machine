#!/bin/bash

# Raspberry Pi Sound Machine Management Script

case "$1" in
    start)
        echo "🚀 Starting Raspberry Pi Sound Machine..."
        cd ~/raspberry-pi-sound-machine
        nohup npm start > soundmachine.log 2>&1 &
        echo "✅ Server started in background (PID: $!)"
        echo "🌐 Access at: http://10.1.40.62:3000"
        ;;
    stop)
        echo "🛑 Stopping Sound Machine..."
        pkill -f "node.*server.js" && echo "✅ Server stopped" || echo "❌ No server process found"
        pkill -f "mpg123" && echo "✅ Audio processes stopped" || echo "ℹ️  No audio processes found"
        ;;
    restart)
        echo "🔄 Restarting Sound Machine..."
        $0 stop
        sleep 2
        $0 start
        ;;
    status)
        echo "📊 Sound Machine Status:"
        if pgrep -f "node.*server.js" > /dev/null; then
            echo "✅ Server is running (PID: $(pgrep -f 'node.*server.js'))"
        else
            echo "❌ Server is not running"
        fi
        
        if pgrep -f "mpg123" > /dev/null; then
            echo "🔊 Audio process running (PID: $(pgrep -f 'mpg123'))"
        else
            echo "🔇 No audio process running"
        fi
        ;;
    logs)
        echo "📋 Sound Machine Logs (Press Ctrl+C to exit):"
        tail -f ~/raspberry-pi-sound-machine/soundmachine.log
        ;;
    *)
        echo "🎵 Raspberry Pi Sound Machine Management"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start    - Start server in background"
        echo "  stop     - Stop server and audio processes"
        echo "  restart  - Stop and start server"
        echo "  status   - Check if server is running"
        echo "  logs     - View live server logs"
        echo ""
        echo "🌐 Access at: http://10.1.40.62:3000"
        ;;
esac
