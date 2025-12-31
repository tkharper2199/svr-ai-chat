import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";
import { runAgent } from "./agent";
import { authenticateClient, Principal } from "./auth";
import * as cookie from "cookie"

interface WebSocketClient extends WebSocket {
  isAlive?: boolean;
  principal?: Principal;
}

interface ChatMessage {
  type: "chat";
  input: string;
  threadId: string;
}

interface PingMessage {
  type: "ping";
}


type ClientMessage = ChatMessage | PingMessage;
export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Set<WebSocketClient> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  private setupWebSocketServer(): void {
    this.wss.on("connection", (ws: WebSocketClient, incoming) => {
      // Extract cookies from headers for authentication
      let rawcookies = incoming.headers["cookie"] || "";
      if (rawcookies === "") {
        console.log("🔒 Unauthorized WebSocket connection attempt - no token provided");
        ws.close(1008, "Unauthorized");
        return;
      }
      let cookies = cookie.parse(rawcookies);
      // Authenticate the client
      let principal = authenticateClient(cookies["auth_token"]);
      if (!principal) {
        console.log("🔒 Unauthorized WebSocket connection attempt - principal not recognized")
        ws.close(1008, "Unauthorized")
        return
      };
      // Associated the principal with the WebSocket connection
      ws.principal = principal;

      console.log("🔌 New WebSocket connection established");
      ws.isAlive = true;
      this.clients.add(ws);

      // Send welcome message
      this.sendMessage(ws, {
        type: "connected",
        message: "Connected to AppServer WebSocket",
        timestamp: new Date().toISOString(),
      });

      // Handle pong responses for heartbeat
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      // Handle incoming messages
      ws.on("message", async (data: Buffer) => {
        try {
          ws.isAlive = true;
          const message: ClientMessage = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
          this.sendError(ws, "Invalid message format");
        }
      });

      // Handle client disconnect
      ws.on("close", () => {
        console.log("🔌 WebSocket connection closed");
        this.clients.delete(ws);
      });

      // Handle errors
      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.clients.delete(ws);
      });
    });

    console.log("✅ WebSocket server initialized on /ws");
  }

  // Handle different types of incoming messages
  private async handleMessage(
    ws: WebSocketClient,
    message: ClientMessage
  ): Promise<void> {
    switch (message.type) {
      case "chat":
        // Handle chat message
        if (!message.input || !ws.principal || !message.threadId) {
          this.sendError(ws, "Missing required fields or not authenticated");
          return;
        }

        console.log(
          `💬 Received chat message from userId=${ws.principal!.userId}, threadId=${message.threadId}`
        );

        try {
          // Run the agent
          const response = await runAgent(
            message.input,
            ws.principal!.userId,
            message.threadId
          );

          console.log(
            `🤖 Sending response to userId=${ws.principal!.userId}, threadId=${message.threadId}`
          );

          // Send the response
          this.sendMessage(ws, {
            type: "chat_response",
            data: response,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Error processing chat message:", error);
          this.sendError(ws, "Failed to process chat message");
        }
        break;

      case "ping":
        // Respond to ping
        this.sendMessage(ws, {
          type: "pong",
          timestamp: new Date().toISOString(),
        });
        break;

      default:
        this.sendError(ws, "Unknown message type");
    }
  }

  // Utility to send messages to clients
  private sendMessage(ws: WebSocketClient, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  // Utility to send error messages to clients
  private sendError(ws: WebSocketClient, error: string): void {
    this.sendMessage(ws, {
      type: "error",
      error,
      timestamp: new Date().toISOString(),
    });
  }

  // Start heartbeat mechanism to keep connections alive
  private startHeartbeat(): void {
    // Send ping every 30 seconds to keep connections alive
    this.pingInterval = setInterval(() => {
      this.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          console.log("🔌 Terminating inactive WebSocket connection");
          this.clients.delete(ws);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  // Broadcast message to all connected clients
  public broadcast(data: any): void {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Send message to specific user
  public sendToUser(userId: string, data: any): void {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.principal?.userId === userId && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Get count of connected clients
  public getClientCount(): number {
    return this.clients.size;
  }

  // Cleanup on shutdown
  public shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.clients.forEach((client) => {
      client.close();
    });

    this.wss.close(() => {
      console.log("🔴 WebSocket server closed");
    });
  }
}
