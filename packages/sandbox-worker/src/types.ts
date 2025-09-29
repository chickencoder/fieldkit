export interface MessagePart {
  text?: string;
  content?: string;
  [key: string]: unknown;
}

export interface UserMessage {
  id: string;
  parts: MessagePart[];
}

export interface MessageChunk {
  type: "text" | "tool_use";
  text?: string;
  name?: string;
  input?: unknown;
  id?: string;
}

export interface QueryOptions {
  permissionMode: "acceptEdits";
  maxTurns: number;
  model: string;
  resume?: string;
}

export interface StreamingState {
  hasInitialized: boolean;
  lastSeenMessageId: string | null;
  messageQueue: UserMessage[];
  messageQueueResolver: ((value: UserMessage | null) => void) | null;
  isStreamingSessionActive: boolean;
  currentProcessingMessage: UserMessage | null;
  currentSessionId: string | null;
}