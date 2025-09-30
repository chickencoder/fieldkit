"use client";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PromptInput,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { MessageRenderer } from "./message-renderer";
import { useQuery, useMutation, usePreloadedQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { useState } from "react";
import { nanoid } from "nanoid";
import type { Preloaded } from "convex/react";
import type { Id } from "@repo/convex/_generated/dataModel";

interface MessagePart {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface MessageData {
  _id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
}

interface ConversationPanelProps {
  sandboxId: string;
  sessionId: Id<"sessions">;
  preloadedMessages: Preloaded<typeof api.sessions.getMessagesBySessionId>;
}

export function ConversationPanel({
  sandboxId,
  sessionId,
  preloadedMessages,
}: ConversationPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const messages = usePreloadedQuery(preloadedMessages) as MessageData[];
  const session = useQuery(api.sessions.getSessionById, { sessionId });
  const insertUserMessage = useMutation(api.messages.insertUserMessage);
  const [input, setInput] = useState("");

  // Check if we're ready to send messages (session exists)
  const isSessionReady = session !== undefined && session !== null;

  const handleSubmit = async (message: PromptInputMessage) => {
    if (message.text && isSessionReady) {
      setIsSubmitting(true);
      try {
        await insertUserMessage({
          id: nanoid(),
          parts: [{ type: "text", text: message.text }],
          metadata: { sandboxId },
          sessionId: sessionId,
        });
        setInput("");
      } catch (error) {
        console.error("Failed to send message:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="w-96 flex flex-col min-h-0">
      <ScrollArea className="flex-1 min-h-0 0 bg-card rounded-lg border mb-2">
        <Conversation className="h-full">
          <ConversationContent className="px-4">
            {messages.length > 0 ? (
              <MessageRenderer messages={messages} />
            ) : (
              <ConversationEmptyState
                title={
                  isSessionReady ? "No messages yet" : "Initializing session..."
                }
                description={
                  isSessionReady
                    ? "Start a conversation with your sandbox"
                    : "Setting up Claude Code session"
                }
              />
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </ScrollArea>
      <PromptInput
        onSubmit={handleSubmit}
        className="relative rounded-lg shadow-none bg-card"
      >
        <PromptInputBody>
          <PromptInputAttachments>
            {(attachment) => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>
          <PromptInputTextarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={!isSessionReady}
            placeholder={
              isSessionReady
                ? "Type your message..."
                : "Waiting for session to initialize..."
            }
          />
        </PromptInputBody>
        <PromptInputToolbar>
          <PromptInputTools />
          <PromptInputSubmit
            disabled={isSubmitting || !isSessionReady}
            status={isSubmitting ? "submitted" : "ready"}
          />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}
