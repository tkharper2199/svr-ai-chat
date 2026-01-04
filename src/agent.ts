import { createAgent, tool, initChatModel, type ToolRuntime } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import * as z from "zod";

// Define system prompt
export const systemPrompt = `You are an expert medical coder, able to answer questions about medical coding and billing.`;

type AgentRuntime = ToolRuntime<unknown, { user_id: string }>;

let agent: any;

/**
 * Gets the response format schema
 * @returns The Zod schema for response format
 */
export function getResponseFormat() {
  return z.object({
    text_response: z.string(),
  });
}

/**
 * Sets the agent instance (useful for testing)
 * @param agentInstance The agent instance to set
 */
export function setAgent(agentInstance: any): void {
  agent = agentInstance;
}

/**
 * Gets the current agent instance
 * @returns The current agent instance
 */
export function getAgent(): any {
  return agent;
}

/**
 * Resets the agent to null (useful for testing)
 */
export function resetAgent(): void {
  agent = null;
}

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

/**
 * Creates and initializes an agent with the given dependencies
 * @param model The chat model to use
 * @param checkpointer The memory checkpointer to use
 * @returns The initialized agent
 */
export async function createAgentInstance(model?: any, checkpointer?: any) {
  const actualModel = model || await initChatModel("claude-sonnet-4-5-20250929");
  const actualCheckpointer = checkpointer || new MemorySaver();
  const responseFormat = getResponseFormat();

  return createAgent({
    model: actualModel,
    systemPrompt,
    responseFormat,
    checkpointer: actualCheckpointer,
    tools: [],
  });
}

/**
 * Initializes the global agent instance
 */
export async function initAgent() {
  agent = await createAgentInstance();
}

// Agent initialization - only run if not in test environment
if (process.env.NODE_ENV !== 'test') {
  initAgent().catch(console.error);
}
