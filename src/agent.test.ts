import {
  runAgent,
  setAgent,
  getAgent,
  resetAgent,
  getResponseFormat,
  createAgentInstance,
  initAgent,
  systemPrompt,
} from "./agent";
import * as z from "zod";

// Mock langchain modules
jest.mock("langchain", () => ({
  createAgent: jest.fn(),
  initChatModel: jest.fn(),
}));

jest.mock("@langchain/langgraph", () => ({
  MemorySaver: jest.fn().mockImplementation(() => ({
    save: jest.fn(),
    load: jest.fn(),
  })),
}));

describe("Agent Module", () => {
  // Mock agent instance
  let mockAgent: any;

  beforeEach(() => {
    jest.clearAllMocks();
    resetAgent();

    // Create a mock agent with invoke method
    mockAgent = {
      invoke: jest.fn(),
    };
  });

  afterEach(() => {
    resetAgent();
  });

  describe("setAgent and getAgent", () => {
    it("should set and get the agent instance", () => {
      expect(getAgent()).toBeNull();

      setAgent(mockAgent);

      expect(getAgent()).toBe(mockAgent);
    });

  });

  describe("resetAgent", () => {
    it("should reset the agent to null", () => {
      setAgent(mockAgent);
      expect(getAgent()).toBe(mockAgent);

      resetAgent();

      expect(getAgent()).toBeNull();
    });
  });

  describe("getResponseFormat", () => {
    it("should return a Zod object schema with expected fields", () => {
      const responseFormat = getResponseFormat();
      const shape = responseFormat.shape;

      expect(responseFormat).toBeDefined();
      expect(responseFormat).toBeInstanceOf(z.ZodObject);
      expect(shape).toHaveProperty("text_response");
      expect(shape.text_response).toBeInstanceOf(z.ZodString);
    });

  });

  describe("runAgent", () => {
    const mockInput = "What is CPT code 99213?";
    const mockUserId = "user123";
    const mockThreadId = "thread456";

    it("should throw error when agent is not initialized", async () => {
      await expect(runAgent(mockInput, mockUserId, mockThreadId)).rejects.toThrow(
        "Agent not initialized"
      );
    });

    it("should call agent.invoke with correct parameters", async () => {
      const mockResponse = {
        structuredResponse: { text_response: "CPT 99213 is an office visit code" },
      };
      mockAgent.invoke.mockResolvedValue(mockResponse);
      setAgent(mockAgent);

      const result = await runAgent(mockInput, mockUserId, mockThreadId);

      expect(mockAgent.invoke).toHaveBeenCalledTimes(1);
      expect(mockAgent.invoke).toHaveBeenCalledWith(
        { messages: [{ role: "user", content: mockInput }] },
        { context: { user_id: mockUserId }, configurable: { thread_id: mockThreadId } }
      );
      expect(result).toEqual(mockResponse.structuredResponse);
    });

    it("should return the structured response from agent", async () => {
      const mockResponse = {
        structuredResponse: { text_response: "This is the response" },
      };
      mockAgent.invoke.mockResolvedValue(mockResponse);
      setAgent(mockAgent);

      const result = await runAgent(mockInput, mockUserId, mockThreadId);

      expect(result).toEqual({ text_response: "This is the response" });
    });

    it("should handle different user and thread IDs", async () => {
      const mockResponse = {
        structuredResponse: { text_response: "Response" },
      };
      mockAgent.invoke.mockResolvedValue(mockResponse);
      setAgent(mockAgent);

      const testCases = [
        { userId: "user1", threadId: "thread1" },
        { userId: "user2", threadId: "thread2" },
        { userId: "admin", threadId: "main-thread" },
      ];

      for (const { userId, threadId } of testCases) {
        mockAgent.invoke.mockClear();
        await runAgent(mockInput, userId, threadId);

        expect(mockAgent.invoke).toHaveBeenCalledWith(
          { messages: [{ role: "user", content: mockInput }] },
          { context: { user_id: userId }, configurable: { thread_id: threadId } }
        );
      }
    });

    it("should propagate errors from agent.invoke", async () => {
      const mockError = new Error("Agent invocation failed");
      mockAgent.invoke.mockRejectedValue(mockError);
      setAgent(mockAgent);

      await expect(runAgent(mockInput, mockUserId, mockThreadId)).rejects.toThrow(
        "Agent invocation failed"
      );
    });
    
  });

  describe("createAgentInstance", () => {
    const { createAgent, initChatModel } = require("langchain");
    const { MemorySaver } = require("@langchain/langgraph");

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should create agent with provided model and checkpointer", async () => {
      const mockModel = { name: "test-model" };
      const mockCheckpointer = { save: jest.fn(), load: jest.fn() };
      const mockCreatedAgent = { invoke: jest.fn() };

      createAgent.mockReturnValue(mockCreatedAgent);

      const result = await createAgentInstance(mockModel, mockCheckpointer);

      expect(createAgent).toHaveBeenCalledTimes(1);
      expect(createAgent).toHaveBeenCalledWith({
        model: mockModel,
        systemPrompt,
        responseFormat: expect.any(z.ZodObject),
        checkpointer: mockCheckpointer,
        tools: [],
      });
      expect(result).toBe(mockCreatedAgent);
      expect(initChatModel).not.toHaveBeenCalled();
    });

    it("should create agent with default model when not provided", async () => {
      const mockDefaultModel = { name: "claude-sonnet" };
      const mockCheckpointer = { save: jest.fn(), load: jest.fn() };
      const mockCreatedAgent = { invoke: jest.fn() };

      initChatModel.mockResolvedValue(mockDefaultModel);
      createAgent.mockReturnValue(mockCreatedAgent);

      const result = await createAgentInstance(undefined, mockCheckpointer);

      expect(initChatModel).toHaveBeenCalledWith("claude-sonnet-4-5-20250929");
      expect(createAgent).toHaveBeenCalledWith({
        model: mockDefaultModel,
        systemPrompt,
        responseFormat: expect.any(z.ZodObject),
        checkpointer: mockCheckpointer,
        tools: [],
      });
      expect(result).toBe(mockCreatedAgent);
    });

    it("should create agent with default checkpointer when not provided", async () => {
      const mockModel = { name: "test-model" };
      const mockCreatedAgent = { invoke: jest.fn() };

      createAgent.mockReturnValue(mockCreatedAgent);

      const result = await createAgentInstance(mockModel);

      expect(MemorySaver).toHaveBeenCalledTimes(1);
      expect(createAgent).toHaveBeenCalledWith({
        model: mockModel,
        systemPrompt,
        responseFormat: expect.any(z.ZodObject),
        checkpointer: expect.any(Object),
        tools: [],
      });
      expect(result).toBe(mockCreatedAgent);
    });

    it("should create agent with all defaults when no parameters provided", async () => {
      const mockDefaultModel = { name: "claude-sonnet" };
      const mockCreatedAgent = { invoke: jest.fn() };

      initChatModel.mockResolvedValue(mockDefaultModel);
      createAgent.mockReturnValue(mockCreatedAgent);

      const result = await createAgentInstance();

      expect(initChatModel).toHaveBeenCalledWith("claude-sonnet-4-5-20250929");
      expect(MemorySaver).toHaveBeenCalled();
      expect(createAgent).toHaveBeenCalledWith({
        model: mockDefaultModel,
        systemPrompt,
        responseFormat: expect.any(z.ZodObject),
        checkpointer: expect.any(Object),
        tools: [],
      });
      expect(result).toBe(mockCreatedAgent);
    });

    it("should use correct system prompt", async () => {
      const mockModel = { name: "test-model" };
      const mockCheckpointer = { save: jest.fn(), load: jest.fn() };
      createAgent.mockReturnValue({ invoke: jest.fn() });

      await createAgentInstance(mockModel, mockCheckpointer);

      const createAgentCall = createAgent.mock.calls[0][0];
      expect(createAgentCall.systemPrompt).toBe(systemPrompt);
    });
  });

  describe("initAgent", () => {
    const { createAgent, initChatModel } = require("langchain");

    beforeEach(() => {
      jest.clearAllMocks();
      resetAgent();
    });

    it("should initialize the global agent", async () => {
      const mockDefaultModel = { name: "claude-sonnet" };
      const mockCreatedAgent = { invoke: jest.fn() };

      initChatModel.mockResolvedValue(mockDefaultModel);
      createAgent.mockReturnValue(mockCreatedAgent);

      expect(getAgent()).toBeNull();

      await initAgent();

      expect(getAgent()).toBe(mockCreatedAgent);
      expect(initChatModel).toHaveBeenCalledWith("claude-sonnet-4-5-20250929");
      expect(createAgent).toHaveBeenCalled();
    });

    it("should allow agent to be used after initialization", async () => {
      const mockDefaultModel = { name: "claude-sonnet" };
      const mockCreatedAgent = {
        invoke: jest.fn().mockResolvedValue({
          structuredResponse: { text_response: "Test response" },
        }),
      };

      initChatModel.mockResolvedValue(mockDefaultModel);
      createAgent.mockReturnValue(mockCreatedAgent);

      await initAgent();

      const result = await runAgent("test input", "user1", "thread1");

      expect(result).toEqual({ text_response: "Test response" });
      expect(mockCreatedAgent.invoke).toHaveBeenCalled();
    });

    it("should replace existing agent when called multiple times", async () => {
      const mockModel = { name: "claude-sonnet" };
      const mockAgent1 = { invoke: jest.fn(), id: 1 };
      const mockAgent2 = { invoke: jest.fn(), id: 2 };

      initChatModel.mockResolvedValue(mockModel);
      createAgent.mockReturnValueOnce(mockAgent1).mockReturnValueOnce(mockAgent2);

      await initAgent();
      expect(getAgent()).toBe(mockAgent1);

      await initAgent();
      expect(getAgent()).toBe(mockAgent2);
    });
  });

});
