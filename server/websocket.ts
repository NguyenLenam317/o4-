import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { saveChatMessage, getChatHistory, storage } from './storage';
import { createServer } from 'http';
import { fork } from 'child_process';
import path from 'path';
import { parse as parseCookie } from 'cookie';
import { getUserIdFromRequest } from './auth';

interface IsolatedSession {
  ws: WebSocket;
  server: WebSocketServer;
  ip: string;
  deviceId: string;
  userId?: number; // Optional userId for authenticated sessions
}

interface DeviceConnection {
  deviceId: string;
  port: number;
  connectedAt: Date;
  lastActive: Date;
}

interface IsolatedProcess {
  process: any;
  port: number;
  deviceId: string;
}

const activeIsolatedSessions = new Map<string, IsolatedSession>();
const activeConnections = new Map<string, DeviceConnection>();
const activeProcesses = new Map<string, IsolatedProcess>();
const deviceServers = new Map<string, {
  httpServer: any;
  wss: WebSocketServer;
  ws?: WebSocket;
}>();

let portCounter = 3000;

/**
 * Create a WebSocket server for real-time updates
 * @param server - HTTP server instance
 * @param sessionMiddleware - Express session middleware for authentication
 * @returns WebSocket server instance
 */
export function createWebSocketServer(server: Server, sessionMiddleware?: any) {
  // Main server just for connection handoff
  const mainWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    // Extract unique connection identifiers
    const ip = request.socket.remoteAddress || 'unknown';
    const deviceId = request.headers['sec-websocket-key'] || 
                    `${ip}-${Date.now()}`;
    
    // Try to get the user ID from the session if session middleware exists
    let userId: number | undefined = undefined;
    
    // If session middleware is provided, use it to get user info
    if (sessionMiddleware) {
      // Extract session ID from cookies if present
      const cookies = request.headers.cookie ? parseCookie(request.headers.cookie) : {};
      const sessionId = cookies['connect.sid'];
      
      // If session ID exists, try to get user info
      if (sessionId) {
        // Apply session middleware to populate request.session
        sessionMiddleware(request, {} as any, () => {
          // Check if user is authenticated
          if (request.session?.passport?.user) {
            userId = request.session.passport.user;
          }
        });
      }
    }
    
    // Create isolated server just for this connection
    const isolatedWss = new WebSocketServer({ noServer: true });
    
    isolatedWss.on('connection', (ws) => {
      const sessionId = `${deviceId}-${Date.now()}`;
      
      activeIsolatedSessions.set(sessionId, {
        ws,
        server: isolatedWss,
        ip,
        deviceId,
        userId // This will be undefined for unauthenticated sessions
      });

      console.log('WebSocket client connected');

      // Send initialization message with session details
      ws.send(JSON.stringify({
        type: 'session_init',
        sessionId,
        deviceId,
        ipAddress: ip,
        authenticated: !!userId,
        userId: userId // Will be undefined for unauthenticated users
      }));

      // Send welcome message with device ID
      ws.send(JSON.stringify({
        type: 'connection',
        deviceId,
        message: 'Connected to Ecosense WebSocket Server'
      }));

      // Get chat history based on authentication status
      const getHistory = async () => {
        let history;
        if (userId) {
          // If authenticated, get user-specific chat history from the database
          const chatHistory = await storage.getChatHistory(userId);
          history = chatHistory?.messages || [];
        } else {
          // Fall back to device-based history for unauthenticated users
          history = await getChatHistory(deviceId);
        }
        
        ws.send(JSON.stringify({
          type: 'history',
          messages: history
        }));
      };
      
      getHistory().catch(err => console.error('Error getting chat history:', err));

      // Handle messages - only this single connection exists
      ws.on('message', (message) => {
        try {
          const parsed = JSON.parse(message.toString());
          
          // Validate session
          if (!parsed.sessionId || !activeIsolatedSessions.has(parsed.sessionId)) {
            return ws.close(1008, 'Invalid session');
          }
          
          // Handle chat messages
          if (parsed.type === 'chat') {
            // Only echo back to same connection
            ws.send(JSON.stringify({
              ...parsed,
              sessionId,
              timestamp: new Date().toISOString()
            }));

            // Save message based on authentication status
            if (activeIsolatedSessions.get(sessionId)?.userId) {
              const userId = activeIsolatedSessions.get(sessionId)?.userId;
              // For authenticated users, save to their user account
              if (userId) {
                storage.getChatHistory(userId).then(chatHistory => {
                  const messages = chatHistory?.messages || [];
                  messages.push({
                    role: 'user',
                    content: parsed.content
                  });
                  storage.updateChatHistory(userId, { messages });
                }).catch(err => console.error('Error updating chat history:', err));
              }
            } else {
              // For unauthenticated users, use the old device-based system
              saveChatMessage(deviceId, parsed.content);
            }
          } else {
            // Handle different message types
            switch (parsed.type) {
              case 'subscribe':
                handleSubscription(ws, parsed);
                break;
              default:
                console.log('Unknown message type:', parsed.type);
            }
          }
        } catch (error) {
          console.error('Isolated session error:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        activeIsolatedSessions.delete(sessionId);
      });
    });

    // Handle the upgrade to the isolated server
    isolatedWss.handleUpgrade(request, socket, head, (ws) => {
      isolatedWss.emit('connection', ws, request);
    });
  });

  return mainWss;
}

/**
 * Handle subscription requests
 * @param ws - WebSocket client
 * @param message - Subscription message
 */
function handleSubscription(ws: WebSocket, message: any) {
  const { channel } = message;
  console.log(`Client subscribed to ${channel}`);

  // Send confirmation
  ws.send(JSON.stringify({
    type: 'subscribed',
    channel
  }));
}

/**
 * Broadcast a message to all connected clients
 * @param wss - WebSocketServer
 * @param message - Message to broadcast
 */
export function broadcastMessage(wss: WebSocketServer, message: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

export function createDeviceIsolatedServer(basePort: number) {
  // Main server just tracks all device servers
  const mainServer = createServer();
  
  // Generate unique ports for each device
  let portCounter = basePort;
  
  return {
    server: mainServer,
    createForDevice: (deviceId: string) => {
      const port = portCounter++;
      const httpServer = createServer();
      
      const wss = new WebSocketServer({ server: httpServer });
      wss.on('connection', (ws) => {
        deviceServers.set(deviceId, { httpServer, wss, ws });
        
        // Completely isolated connection
        ws.on('message', (message) => {
          // Only echo back to same device
          ws.send(message);
        });

        const deviceConnection: DeviceConnection = {
          deviceId,
          port,
          connectedAt: new Date(),
          lastActive: new Date()
        };

        activeConnections.set(deviceId, deviceConnection);

        ws.on('close', () => {
          activeConnections.delete(deviceId);
        });
      });
      
      httpServer.listen(port, () => {
        console.log(`Isolated server for ${deviceId} on port ${port}`);
      });
      
      return {
        port,
        close: () => {
          httpServer.close();
          deviceServers.delete(deviceId);
        }
      };
    }
  };
}

export function createIsolatedProcess(deviceId: string) {
  const port = portCounter++;
  const workerPath = path.join(__dirname, 'worker.js');
  
  const worker = fork(workerPath, [
    '--device-id', deviceId,
    '--port', port.toString()
  ]);
  
  const processInfo: IsolatedProcess = {
    process: worker,
    port,
    deviceId
  };
  
  activeProcesses.set(deviceId, processInfo);
  
  worker.on('exit', () => {
    activeProcesses.delete(deviceId);
  });
  
  return {
    port,
    disconnect: () => worker.kill()
  };
}

function generateDeviceId(req: any): string {
  return [
    req.headers['user-agent'],
    req.headers['sec-websocket-key'],
    req.socket.remoteAddress,
    Date.now()
  ].join('-');
}

function cleanupInactiveDevices() {
  const now = new Date();
  for (const [deviceId, conn] of activeConnections) {
    if (now.getTime() - conn.lastActive.getTime() > 30 * 60 * 1000) {
      deviceServers.get(deviceId)?.close();
      activeConnections.delete(deviceId);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupInactiveDevices, 5 * 60 * 1000);