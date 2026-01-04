import { WebSocketManager } from "./websocket";
import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";
import { runAgent } from "./agent";
import { authenticateClient, Principal } from "./auth";
import * as cookie from "cookie";

// Mock dependencies
jest.mock("ws");
jest.mock("./agent");
jest.mock("./auth");
jest.mock("cookie");

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

describe("WebSocketManager", () => {
  let mockServer: Server;
  let mockWss: any;
  let mockWs: any;
  let wsManager: WebSocketManager;
  let connectionHandler: any;
  let messageHandler: any;
  let closeHandler: any;
  let errorHandler: any;
  let pongHandler: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(global, 'setInterval');
    jest.spyOn(global, 'clearInterval');

    // Mock HTTP Server
    mockServer = {} as Server;

    // Mock WebSocket instance
    mockWs = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      terminate: jest.fn(),
      ping: jest.fn(),
      readyState: WebSocket.OPEN,
      isAlive: true,
      principal: undefined,
    };

    // Capture event handlers when they are registered
    mockWs.on.mockImplementation((event: string | symbol, handler: any) => {
      const eventStr = event.toString();
      if (eventStr === "message") {
        messageHandler = handler;
      } else if (eventStr === "close") {
        closeHandler = handler;
      } else if (eventStr === "error") {
        errorHandler = handler;
      } else if (eventStr === "pong") {
        pongHandler = handler;
      }
      return mockWs;
    });

    // Mock WebSocketServer
    mockWss = {
      on: jest.fn(),
      close: jest.fn(),
    };

    // Capture connection handler
    mockWss.on.mockImplementation((event: string | symbol, handler: any) => {
      if (event.toString() === "connection") {
        connectionHandler = handler;
      }
      return mockWss;
    });

    // Mock WebSocketServer constructor
    (WebSocketServer as jest.MockedClass<typeof WebSocketServer>).mockImplementation(
      () => mockWss
    );

    // Mock cookie.parse
    (cookie.parse as jest.Mock).mockReturnValue({ auth_token: "valid-token" });

    // Mock authenticateClient
    (authenticateClient as jest.Mock).mockReturnValue({
      userId: "test-user",
    } as Principal);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Constructor", () => {
    it("should create WebSocketServer with correct configuration", () => {
      wsManager = new WebSocketManager(mockServer);

      expect(WebSocketServer).toHaveBeenCalledWith({
        server: mockServer,
        path: "/ws",
      });
    });

    it("should setup connection handler", () => {
      wsManager = new WebSocketManager(mockServer);

      expect(mockWss.on).toHaveBeenCalledWith("connection", expect.any(Function));
    });

    it("should start heartbeat interval", () => {
      wsManager = new WebSocketManager(mockServer);

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it("should log initialization message", () => {
      wsManager = new WebSocketManager(mockServer);

      expect(console.log).toHaveBeenCalledWith("✅ WebSocket server initialized on /ws");
    });
  });

  describe("Connection Handling", () => {
    beforeEach(() => {
      wsManager = new WebSocketManager(mockServer);
    });

    it("should accept connection with valid auth token", () => {
      const mockIncoming = {
        headers: { cookie: "auth_token=valid-token" },
      };

      connectionHandler(mockWs, mockIncoming);

      expect(cookie.parse).toHaveBeenCalledWith("auth_token=valid-token");
      expect(authenticateClient).toHaveBeenCalledWith("valid-token");
      expect(mockWs.principal).toEqual({ userId: "test-user" });
      expect(mockWs.isAlive).toBe(true);
    });

    it("should reject connection without cookies", () => {
      const mockIncoming = {
        headers: {},
      };

      connectionHandler(mockWs, mockIncoming);

      expect(mockWs.close).toHaveBeenCalledWith(1008, "Unauthorized");
      expect(console.log).toHaveBeenCalledWith(
        "🔒 Unauthorized WebSocket connection attempt - no token provided"
      );
    });

    it("should reject connection with empty cookie string", () => {
      const mockIncoming = {
        headers: { cookie: "" },
      };

      connectionHandler(mockWs, mockIncoming);

      expect(mockWs.close).toHaveBeenCalledWith(1008, "Unauthorized");
    });

    it("should reject connection when principal is not recognized", () => {
      (authenticateClient as jest.Mock).mockReturnValue(null);
      const mockIncoming = {
        headers: { cookie: "auth_token=invalid-token" },
      };

      connectionHandler(mockWs, mockIncoming);

      expect(mockWs.close).toHaveBeenCalledWith(1008, "Unauthorized");
      expect(console.log).toHaveBeenCalledWith(
        "🔒 Unauthorized WebSocket connection attempt - principal not recognized"
      );
    });

    it("should send welcome message on successful connection", () => {
      const mockIncoming = {
        headers: { cookie: "auth_token=valid-token" },
      };

      connectionHandler(mockWs, mockIncoming);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"connected"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("Connected to AppServer WebSocket")
      );
    });

    it("should register event handlers on connection", () => {
      const mockIncoming = {
        headers: { cookie: "auth_token=valid-token" },
      };

      connectionHandler(mockWs, mockIncoming);

      expect(mockWs.on).toHaveBeenCalledWith("pong", expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith("message", expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith("close", expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should add client to clients set", () => {
      const mockIncoming = {
        headers: { cookie: "auth_token=valid-token" },
      };

      connectionHandler(mockWs, mockIncoming);

      expect(wsManager.getClientCount()).toBe(1);
    });
  });

  describe("Message Handling", () => {
    beforeEach(() => {
      wsManager = new WebSocketManager(mockServer);
      const mockIncoming = {
        headers: { cookie: "auth_token=valid-token" },
      };
      connectionHandler(mockWs, mockIncoming);
      jest.clearAllMocks();
    });

    describe("Chat Messages", () => {
      it("should process valid chat message", async () => {
        const chatMessage = {
          type: "chat",
          input: "Hello, AI!",
          threadId: "thread-123",
        };
        const mockAgentResponse = { text_response: "Hello, human!" };
        (runAgent as jest.Mock).mockResolvedValue(mockAgentResponse);

        await messageHandler(Buffer.from(JSON.stringify(chatMessage)));

        expect(runAgent).toHaveBeenCalledWith("Hello, AI!", "test-user", "thread-123");
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining('"type":"chat_response"')
        );
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining(mockAgentResponse.text_response)
        );
      });

      it("should set isAlive to true when receiving message", async () => {
        mockWs.isAlive = false;
        const chatMessage = {
          type: "chat",
          input: "Test",
          threadId: "thread-123",
        };
        (runAgent as jest.Mock).mockResolvedValue({ text_response: "Response" });

        await messageHandler(Buffer.from(JSON.stringify(chatMessage)));

        expect(mockWs.isAlive).toBe(true);
      });

      it("should send error when input is missing", async () => {
        const chatMessage = {
          type: "chat",
          threadId: "thread-123",
        };

        await messageHandler(Buffer.from(JSON.stringify(chatMessage)));

        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining('"type":"error"')
        );
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining("Missing required fields or not authenticated")
        );
      });

      it("should send error when threadId is missing", async () => {
        const chatMessage = {
          type: "chat",
          input: "Hello",
        };

        await messageHandler(Buffer.from(JSON.stringify(chatMessage)));

        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining("Missing required fields or not authenticated")
        );
      });

      it("should send error when principal is not set", async () => {
        mockWs.principal = undefined;
        const chatMessage = {
          type: "chat",
          input: "Hello",
          threadId: "thread-123",
        };

        await messageHandler(Buffer.from(JSON.stringify(chatMessage)));

        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining("Missing required fields or not authenticated")
        );
      });

      it("should handle agent errors gracefully", async () => {
        const chatMessage = {
          type: "chat",
          input: "Hello",
          threadId: "thread-123",
        };
        (runAgent as jest.Mock).mockRejectedValue(new Error("Agent failed"));

        await messageHandler(Buffer.from(JSON.stringify(chatMessage)));

        expect(console.error).toHaveBeenCalledWith(
          "Error processing chat message:",
          expect.any(Error)
        );
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining("Failed to process chat message")
        );
      });
    });

    describe("Ping Messages", () => {
      it("should respond to ping with pong", async () => {
        const pingMessage = {
          type: "ping",
        };

        await messageHandler(Buffer.from(JSON.stringify(pingMessage)));

        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining('"type":"pong"')
        );
        expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining("timestamp"));
      });
    });

    describe("Invalid Messages", () => {
      it("should send error for unknown message type", async () => {
        const invalidMessage = {
          type: "unknown",
        };

        await messageHandler(Buffer.from(JSON.stringify(invalidMessage)));

        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining("Unknown message type")
        );
      });

      it("should send error for invalid JSON", async () => {
        await messageHandler(Buffer.from("invalid json"));

        expect(console.error).toHaveBeenCalledWith(
          "Error parsing WebSocket message:",
          expect.any(Error)
        );
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining("Invalid message format")
        );
      });

      it("should not crash on malformed data", async () => {
        await expect(messageHandler(Buffer.from("{broken:"))).resolves.not.toThrow();
      });
    });
  });

  describe("Event Handlers", () => {
    beforeEach(() => {
      wsManager = new WebSocketManager(mockServer);
      const mockIncoming = {
        headers: { cookie: "auth_token=valid-token" },
      };
      connectionHandler(mockWs, mockIncoming);
      jest.clearAllMocks();
    });

    it("should set isAlive to true on pong", () => {
      mockWs.isAlive = false;

      pongHandler();

      expect(mockWs.isAlive).toBe(true);
    });

    it("should remove client on close", () => {
      expect(wsManager.getClientCount()).toBe(1);

      closeHandler();

      expect(wsManager.getClientCount()).toBe(0);
      expect(console.log).toHaveBeenCalledWith("🔌 WebSocket connection closed");
    });

    it("should remove client on error", () => {
      const mockError = new Error("WebSocket error");
      expect(wsManager.getClientCount()).toBe(1);

      errorHandler(mockError);

      expect(wsManager.getClientCount()).toBe(0);
      expect(console.error).toHaveBeenCalledWith("WebSocket error:", mockError);
    });
  });

  describe("Heartbeat Mechanism", () => {
    beforeEach(() => {
      wsManager = new WebSocketManager(mockServer);
    });

    it("should ping clients every 30 seconds", () => {
      const mockIncoming = {
        headers: { cookie: "auth_token=valid-token" },
      };
      connectionHandler(mockWs, mockIncoming);

      jest.advanceTimersByTime(30000);

      expect(mockWs.ping).toHaveBeenCalled();
    });

    it("should set isAlive to false before pinging", () => {
      const mockIncoming = {
        headers: { cookie: "auth_token=valid-token" },
      };
      connectionHandler(mockWs, mockIncoming);
      mockWs.isAlive = true;

      jest.advanceTimersByTime(30000);

      expect(mockWs.isAlive).toBe(false);
    });

    it("should terminate inactive connections", () => {
      const mockIncoming = {
        headers: { cookie: "auth_token=valid-token" },
      };
      connectionHandler(mockWs, mockIncoming);
      mockWs.isAlive = false;

      jest.advanceTimersByTime(30000);

      expect(mockWs.terminate).toHaveBeenCalled();
      expect(wsManager.getClientCount()).toBe(0);
    });

    it("should not terminate active connections", () => {
      const mockIncoming = {
        headers: { cookie: "auth_token=valid-token" },
      };
      connectionHandler(mockWs, mockIncoming);
      mockWs.isAlive = true;

      jest.advanceTimersByTime(30000);

      expect(mockWs.terminate).not.toHaveBeenCalled();
      expect(wsManager.getClientCount()).toBe(1);
    });

    it("should handle multiple clients", () => {
      const mockWs2 = { ...mockWs, isAlive: true, ping: jest.fn(), on: jest.fn().mockReturnThis() };
      const mockWs3 = { ...mockWs, isAlive: true, ping: jest.fn(), on: jest.fn().mockReturnThis() };

      const mockIncoming = {
        headers: { cookie: "auth_token=valid-token" },
      };

      connectionHandler(mockWs, mockIncoming);
      connectionHandler(mockWs2, mockIncoming);
      connectionHandler(mockWs3, mockIncoming);

      jest.advanceTimersByTime(30000);

      expect(mockWs.ping).toHaveBeenCalled();
      expect(mockWs2.ping).toHaveBeenCalled();
      expect(mockWs3.ping).toHaveBeenCalled();
    });
  });

  describe("Public Methods", () => {
    beforeEach(() => {
      wsManager = new WebSocketManager(mockServer);
    });

    describe("broadcast", () => {
      it("should send message to all connected clients", () => {
        const mockWs2 = { ...mockWs, send: jest.fn(), readyState: WebSocket.OPEN, on: jest.fn().mockReturnThis() };
        const mockWs3 = { ...mockWs, send: jest.fn(), readyState: WebSocket.OPEN, on: jest.fn().mockReturnThis() };

        const mockIncoming = {
          headers: { cookie: "auth_token=valid-token" },
        };

        connectionHandler(mockWs, mockIncoming);
        connectionHandler(mockWs2, mockIncoming);
        connectionHandler(mockWs3, mockIncoming);

        const broadcastData = { type: "announcement", message: "Hello everyone" };
        wsManager.broadcast(broadcastData);

        expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(broadcastData));
        expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(broadcastData));
        expect(mockWs3.send).toHaveBeenCalledWith(JSON.stringify(broadcastData));
      });

      it("should not send to clients with non-OPEN state", () => {
        const mockWsClosed = {
          ...mockWs,
          send: jest.fn(),
          readyState: WebSocket.CLOSED,
          on: jest.fn().mockReturnThis(),
        };

        const mockIncoming = {
          headers: { cookie: "auth_token=valid-token" },
        };

        connectionHandler(mockWs, mockIncoming);
        connectionHandler(mockWsClosed, mockIncoming);

        const broadcastData = { type: "announcement", message: "Hello" };
        wsManager.broadcast(broadcastData);

        expect(mockWs.send).toHaveBeenCalled();
        expect(mockWsClosed.send).not.toHaveBeenCalled();
      });

      it("should handle empty client list", () => {
        expect(() => wsManager.broadcast({ message: "test" })).not.toThrow();
      });
    });

    describe("sendToUser", () => {
      it("should send message only to specific user", () => {
        const mockWs2 = {
          ...mockWs,
          send: jest.fn(),
          readyState: WebSocket.OPEN,
          principal: { userId: "user-2" },
          on: jest.fn().mockReturnThis(),
        };

        const mockIncoming1 = {
          headers: { cookie: "auth_token=token1" },
        };
        const mockIncoming2 = {
          headers: { cookie: "auth_token=token2" },
        };

        (authenticateClient as jest.Mock)
          .mockReturnValueOnce({ userId: "user-1" })
          .mockReturnValueOnce({ userId: "user-2" });

        connectionHandler(mockWs, mockIncoming1);
        connectionHandler(mockWs2, mockIncoming2);

        // Clear send calls from connection messages
        mockWs.send.mockClear();
        mockWs2.send.mockClear();

        const userData = { type: "notification", message: "Hello user-2" };
        wsManager.sendToUser("user-2", userData);

        expect(mockWs.send).not.toHaveBeenCalled();
        expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(userData));
      });

      it("should send to all connections of the same user", () => {
        const mockWs2 = {
          ...mockWs,
          send: jest.fn(),
          readyState: WebSocket.OPEN,
          principal: { userId: "user-1" },
          on: jest.fn().mockReturnThis(),
        };

        const mockIncoming = {
          headers: { cookie: "auth_token=valid-token" },
        };

        (authenticateClient as jest.Mock).mockReturnValue({ userId: "user-1" });

        connectionHandler(mockWs, mockIncoming);
        connectionHandler(mockWs2, mockIncoming);

        // Clear send calls from connection messages
        mockWs.send.mockClear();
        mockWs2.send.mockClear();

        const userData = { type: "notification", message: "Hello user-1" };
        wsManager.sendToUser("user-1", userData);

        expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(userData));
        expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(userData));
      });

      it("should not send to clients with non-OPEN state", () => {
        const mockWsClosed = {
          ...mockWs,
          send: jest.fn(),
          readyState: WebSocket.CLOSED,
          principal: { userId: "test-user" },
          on: jest.fn().mockReturnThis(),
        };

        const mockIncoming = {
          headers: { cookie: "auth_token=valid-token" },
        };

        connectionHandler(mockWs, mockIncoming);
        connectionHandler(mockWsClosed, mockIncoming);

        // Clear send calls from connection messages
        mockWs.send.mockClear();
        mockWsClosed.send.mockClear();

        wsManager.sendToUser("test-user", { message: "test" });

        expect(mockWs.send).toHaveBeenCalled();
        expect(mockWsClosed.send).not.toHaveBeenCalled();
      });

      it("should handle non-existent user gracefully", () => {
        const mockIncoming = {
          headers: { cookie: "auth_token=valid-token" },
        };
        connectionHandler(mockWs, mockIncoming);

        // Clear send calls from connection messages
        mockWs.send.mockClear();

        expect(() =>
          wsManager.sendToUser("non-existent-user", { message: "test" })
        ).not.toThrow();

        expect(mockWs.send).not.toHaveBeenCalled();
      });
    });

    describe("getClientCount", () => {
      it("should return 0 when no clients connected", () => {
        expect(wsManager.getClientCount()).toBe(0);
      });

      it("should return correct count of connected clients", () => {
        const mockWs2 = { ...mockWs, on: jest.fn().mockReturnThis() };
        const mockWs3 = { ...mockWs, on: jest.fn().mockReturnThis() };

        const mockIncoming = {
          headers: { cookie: "auth_token=valid-token" },
        };

        connectionHandler(mockWs, mockIncoming);
        expect(wsManager.getClientCount()).toBe(1);

        connectionHandler(mockWs2, mockIncoming);
        expect(wsManager.getClientCount()).toBe(2);

        connectionHandler(mockWs3, mockIncoming);
        expect(wsManager.getClientCount()).toBe(3);
      });

      it("should decrease when clients disconnect", () => {
        const mockWs2 = {
          ...mockWs,
          on: jest.fn((event, handler) => {
            if (event === "close") {
              closeHandler = handler;
            }
            return mockWs2;
          }),
        } as any;

        const mockIncoming = {
          headers: { cookie: "auth_token=valid-token" },
        };

        connectionHandler(mockWs, mockIncoming);
        connectionHandler(mockWs2, mockIncoming);
        expect(wsManager.getClientCount()).toBe(2);

        // Simulate disconnect
        const clients = (wsManager as any).clients;
        clients.delete(mockWs);
        expect(wsManager.getClientCount()).toBe(1);
      });
    });

    describe("shutdown", () => {
      it("should clear heartbeat interval", () => {
        wsManager.shutdown();

        expect(clearInterval).toHaveBeenCalled();
      });

      it("should close all client connections", () => {
        const mockWs2 = { ...mockWs, close: jest.fn(), on: jest.fn().mockReturnThis() };
        const mockWs3 = { ...mockWs, close: jest.fn(), on: jest.fn().mockReturnThis() };

        const mockIncoming = {
          headers: { cookie: "auth_token=valid-token" },
        };

        connectionHandler(mockWs, mockIncoming);
        connectionHandler(mockWs2, mockIncoming);
        connectionHandler(mockWs3, mockIncoming);

        wsManager.shutdown();

        expect(mockWs.close).toHaveBeenCalled();
        expect(mockWs2.close).toHaveBeenCalled();
        expect(mockWs3.close).toHaveBeenCalled();
      });

      it("should close WebSocket server", () => {
        wsManager.shutdown();

        expect(mockWss.close).toHaveBeenCalledWith(expect.any(Function));
      });

      it("should log shutdown message", () => {
        const closeCb = jest.fn();
        mockWss.close.mockImplementation((callback: any) => {
          callback();
          return mockWss;
        });

        wsManager.shutdown();

        expect(console.log).toHaveBeenCalledWith("🔴 WebSocket server closed");
      });

      it("should handle shutdown when no clients are connected", () => {
        expect(() => wsManager.shutdown()).not.toThrow();
      });

      it("should handle shutdown when interval is null", () => {
        (wsManager as any).pingInterval = null;
        expect(() => wsManager.shutdown()).not.toThrow();
      });
    });
  });

  describe("Edge Cases", () => {
    beforeEach(() => {
      wsManager = new WebSocketManager(mockServer);
    });

    it("should handle rapid connections and disconnections", () => {
      const mockIncoming = {
        headers: { cookie: "auth_token=valid-token" },
      };

      for (let i = 0; i < 100; i++) {
        const ws = { ...mockWs, on: jest.fn().mockReturnThis() } as any;
        connectionHandler(ws, mockIncoming);
      }

      expect(wsManager.getClientCount()).toBe(100);

      // Disconnect all
      const clients = (wsManager as any).clients;
      clients.clear();
      expect(wsManager.getClientCount()).toBe(0);
    });

    it("should handle very large messages", async () => {
      const mockIncoming = {
        headers: { cookie: "auth_token=valid-token" },
      };
      connectionHandler(mockWs, mockIncoming);

      const largeInput = "A".repeat(100000);
      const chatMessage = {
        type: "chat",
        input: largeInput,
        threadId: "thread-123",
      };

      (runAgent as jest.Mock).mockResolvedValue({ text_response: "Response" });

      await messageHandler(Buffer.from(JSON.stringify(chatMessage)));

      expect(runAgent).toHaveBeenCalledWith(largeInput, "test-user", "thread-123");
    });

    it("should handle special characters in messages", async () => {
      const mockIncoming = {
        headers: { cookie: "auth_token=valid-token" },
      };
      connectionHandler(mockWs, mockIncoming);

      const specialInput = '<script>alert("xss")</script> 😀 \n\t\r';
      const chatMessage = {
        type: "chat",
        input: specialInput,
        threadId: "thread-123",
      };

      (runAgent as jest.Mock).mockResolvedValue({ text_response: "Response" });

      await messageHandler(Buffer.from(JSON.stringify(chatMessage)));

      expect(runAgent).toHaveBeenCalledWith(specialInput, "test-user", "thread-123");
    });

    it("should not send message to closed websocket", () => {
      const mockWsClosed = {
        ...mockWs,
        readyState: WebSocket.CLOSED,
      };
      const mockIncoming = {
        headers: { cookie: "auth_token=valid-token" },
      };
      connectionHandler(mockWsClosed, mockIncoming);

      wsManager.broadcast({ message: "test" });

      // send should not be called because readyState is CLOSED
      expect(mockWsClosed.send).toHaveBeenCalledTimes(0);
    });
  });
});
