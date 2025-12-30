import { createAgent, tool, initChatModel, type ToolRuntime } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import * as z from "zod";

// Define system prompt
const systemPrompt = `You are an expert medical coder, able to answer questions about medical coding and billing.`;

type AgentRuntime = ToolRuntime<unknown, { user_id: string }>;

let agent: any;

/**
 * Invokes the agent with the given input prompt, user id, and thread id.
 * @param input Input prompt
 * @param userId The user id
 * @param threadId The thread id
 * @returns The AI's structured response
 */
export async function runAgent(
  input: string,
  userId: string,
  threadId: string
) {
  if (!agent) {
    throw new Error("Agent not initialized");
  }
  const response = await agent.invoke(
    { messages: [{ role: "user", content: input }] },
    { context: { user_id: userId }, configurable: { thread_id: threadId } }
  );

  return response.structuredResponse;
}

// Agent initialization
async function init() {
  // Configure model
  const model = await initChatModel("claude-sonnet-4-5-20250929");

  // Define response format
  const responseFormat = z.object({
    text_response: z.string(),
  });

  // Set up memory
  const checkpointer = new MemorySaver();

  // Create agent
  agent = createAgent({
    model,
    systemPrompt,
    responseFormat,
    checkpointer,
    tools: [],
  });
}

init().catch(console.error);
