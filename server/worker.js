const http = require('http');
const WebSocket = require('ws');

const args = process.argv.slice(2);
const deviceId = args[args.indexOf('--device-id') + 1];
const port = parseInt(args[args.indexOf('--port') + 1]);

console.log(`[${new Date().toISOString()}] Starting isolated process for ${deviceId}`);

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log(`[${new Date().toISOString()}] Connection from device ${deviceId}`);
  
  ws.on('message', (message) => {
    console.log(`[${new Date().toISOString()}] Received from ${deviceId}:`, message.toString());
    
    // Only echo back to same connection
    ws.send(message);
    console.log(`[${new Date().toISOString()}] Echoed back to ${deviceId}`);
  });
});

server.listen(port, () => {
  console.log(`[${new Date().toISOString()}] Isolated process for ${deviceId} running on port ${port}`);
});

process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] Terminating process for ${deviceId}`);
  server.close();
  process.exit(0);
});
