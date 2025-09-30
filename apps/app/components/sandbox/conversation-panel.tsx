"use client";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
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
  PromptInputModelSelect,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectValue,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
} from "@/components/ai-elements/prompt-input";
import { MessageRenderer } from "./message-renderer";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageContent,
  MessageAvatar,
} from "@/components/ai-elements/message";
import { useQuery, useMutation, usePreloadedQuery } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { useState, useEffect } from "react";
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
  const [showThinking, setShowThinking] = useState(false);
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4.5");

  const messages = usePreloadedQuery(preloadedMessages);
  const session = useQuery(api.sessions.getSessionById, { sessionId });
  const insertUserMessage = useMutation(api.messages.insertUserMessage);
  const [input, setInput] = useState("");

  // Check if we're ready to send messages (session exists)
  const isSessionReady = session !== undefined && session !== null;

  const lastAssistantMessage = messages
    .filter((message) => message.role === "assistant")
    .sort((a, b) => b._creationTime - a._creationTime)[0];

  console.log(lastAssistantMessage);

  const isGenerating =
    lastAssistantMessage?.metadata.isComplete === false || isSubmitting;

  const handleSubmit = async (message: PromptInputMessage) => {
    if (message.text && isSessionReady) {
      setShowThinking(true);
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
        setShowThinking(false);
      }
    }
  };

  // Hide thinking state once we get a real assistant message
  useEffect(() => {
    if (showThinking && lastAssistantMessage) {
      setShowThinking(false);
    }
  }, [showThinking, lastAssistantMessage]);

  return (
    <div className="w-96 flex flex-col min-h-0">
      <Conversation className="flex-1 min-h-0">
        <ConversationContent className="pl-2 pr-4">
          {messages.length > 0 ? (
            <>
              <MessageRenderer messages={messages as MessageData[]} />
              {showThinking && (
                <Message from="system">
                  <MessageContent variant="flat">
                    <div className="inline-flex items-center gap-2">
                      <MessageAvatar
                        src="/claude.png"
                        name="Assistant"
                        className="size-4 ring-0"
                      />
                      <span className="font-medium">Claude</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Loader size={14} />
                      <span>Thinking...</span>
                    </div>
                  </MessageContent>
                </Message>
              )}
            </>
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
      <PromptInput
        onSubmit={handleSubmit}
        className="relative shadow-lg bg-card"
      >
        <PromptInputBody className="border-0">
          <PromptInputAttachments>
            {(attachment) => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>
          <PromptInputTextarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={!isSessionReady}
            placeholder={
              isSessionReady
                ? "Ask anything to Claude..."
                : "Waiting for session to initialize..."
            }
          />
        </PromptInputBody>
        <PromptInputToolbar>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <PromptInputModelSelect
              value={selectedModel}
              onValueChange={setSelectedModel}
            >
              <PromptInputModelSelectTrigger className="w-38 text-xs">
                <PromptInputModelSelectValue />
              </PromptInputModelSelectTrigger>
              <PromptInputModelSelectContent>
                <PromptInputModelSelectItem value="claude-sonnet-4.5">
                  Claude Sonnet 4.5
                </PromptInputModelSelectItem>
                <PromptInputModelSelectItem value="claude-opus-4.1">
                  Claude Opus 4.1
                </PromptInputModelSelectItem>
              </PromptInputModelSelectContent>
            </PromptInputModelSelect>
          </PromptInputTools>
          <PromptInputSubmit
            disabled={isGenerating || !isSessionReady}
            status={isGenerating ? "streaming" : "ready"}
            variant="secondary"
          />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}
