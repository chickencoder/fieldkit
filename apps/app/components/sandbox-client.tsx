"use client";

import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewUrl,
  WebPreviewBody,
} from "@/components/ai-elements/web-preview";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Response } from "@/components/ai-elements/response";
import {
  Message,
  MessageContent,
  MessageAvatar,
} from "@/components/ai-elements/message";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskItemFile,
  TaskTrigger,
} from "@/components/ai-elements/task";
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
} from "./ai-elements/prompt-input";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { useState } from "react";
import { nanoid } from "nanoid";
import { getWorkerLogsAction, getWorkerStatusAction, debugSandboxAction } from "@/actions/worker-status";

export function SandboxClient({
  sandboxId,
  domain,
}: {
  sandboxId: string;
  domain: string;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const messages = useQuery(api.messages.getAllMessages);
  const insertUserMessage = useMutation(api.messages.insertUserMessage);

  const handleSubmit = async (message: PromptInputMessage) => {
    if (message.text) {
      setIsSubmitting(true);
      try {
        await insertUserMessage({
          id: nanoid(),
          parts: [{ type: "text", text: message.text }],
          metadata: { sandboxId },
        });
      } catch (error) {
        console.error("Failed to send message:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDebugWorker = async () => {
    console.log("🔍 Debugging worker for sandbox:", sandboxId);

    try {
      // Get worker status
      const status = await getWorkerStatusAction({ sandboxId });
      console.log("📊 Worker Status:", status);

      if (!status.data?.success) {
        console.error("❌ Failed to get worker status:", status.data?.error);
        return;
      }

      // Get detailed sandbox debug info
      const debug = await debugSandboxAction({ sandboxId });
      console.log("🔧 Sandbox Debug Info:");
      if (debug.data?.success) {
        console.log(debug.data.debug || "No debug output");
      } else {
        console.error("❌ Debug command failed:", debug.data?.error);
      }

      // Get worker logs
      const logs = await getWorkerLogsAction({ sandboxId });
      console.log("📝 Worker Logs:");
      if (logs.data?.success) {
        console.log(logs.data.logs || "No logs found");
      } else {
        console.error("❌ Failed to get logs:", logs.data?.error);
      }

      if (!status.data?.isRunning) {
        console.warn("⚠️ Worker is not running!");
        console.log("💡 This could mean:");
        console.log("  - Sandbox is not running");
        console.log("  - Worker was never injected");
        console.log("  - Worker failed to start");
      }
    } catch (error) {
      console.error("❌ Failed to debug worker:", error);
    }
  };

  return (
    <div className="h-dvh flex gap-4 p-4">
      <div className="w-96 flex flex-col min-h-0">
        <Conversation className="flex-1 min-h-0">
          <ConversationContent className="p-1">
            {messages && messages.length > 0 ? (
              messages.map((message) => {
                const textParts = message.parts.filter(
                  (part) => part.type === "text",
                );
                const toolParts = message.parts.filter(
                  (part) =>
                    part.type === "tool_use" && part.name !== "TodoWrite",
                );
                const latestTodoWrite = message.parts
                  .filter(
                    (part) =>
                      part.type === "tool_use" && part.name === "TodoWrite",
                  )
                  .pop();

                const getToolTriggerContent = (part: any) => {
                  const fileName = part.input?.file_path?.split("/").pop();

                  switch (part.name) {
                    case "Glob":
                      return (
                        <span className="flex items-center gap-2">
                          Searching for{" "}
                          <TaskItemFile>
                            {part.input?.pattern || "files"}
                          </TaskItemFile>
                        </span>
                      );
                    case "Read":
                      return (
                        <span className="flex items-center gap-2">
                          Reading{" "}
                          <TaskItemFile>{fileName || "file"}</TaskItemFile>
                        </span>
                      );
                    case "Edit":
                      return (
                        <span className="flex items-center gap-2">
                          Editing{" "}
                          <TaskItemFile>{fileName || "file"}</TaskItemFile>
                        </span>
                      );
                    case "Write":
                      return (
                        <span className="flex items-center gap-2">
                          Writing{" "}
                          <TaskItemFile>{fileName || "file"}</TaskItemFile>
                        </span>
                      );
                    case "Bash":
                      return `Running: ${part.input?.command?.slice(0, 40) || "bash"}${part.input?.command?.length > 40 ? "..." : ""}`;
                    case "Grep":
                      return (
                        <span className="flex items-center gap-2">
                          Searching for{" "}
                          <TaskItemFile>
                            {part.input?.pattern || "pattern"}
                          </TaskItemFile>
                        </span>
                      );
                    case "Task":
                      return part.input?.description || "Running task";
                    case "WebFetch":
                      return `Fetching ${part.input?.url || "web content"}`;
                    case "WebSearch":
                      return (
                        <span className="flex items-center gap-2">
                          Web search:{" "}
                          <TaskItemFile>
                            {part.input?.query || "query"}
                          </TaskItemFile>
                        </span>
                      );
                    default:
                      return `${part.name}`;
                  }
                };

                return (
                  <div key={message._id}>
                    {textParts.length > 0 && (
                      <Message from={message.role}>
                        <MessageContent>
                          {textParts.map((part, index) => (
                            <Response key={index}>{part.text}</Response>
                          ))}
                        </MessageContent>
                        <MessageAvatar
                          src={
                            message.role === "user"
                              ? "/user-avatar.png"
                              : "/assistant-avatar.png"
                          }
                          name={message.role === "user" ? "User" : "Assistant"}
                        />
                      </Message>
                    )}

                    {latestTodoWrite &&
                      latestTodoWrite.input?.todos &&
                      toolParts.length > 0 && (
                        <div className="mb-2">
                          {latestTodoWrite.input.todos
                            .filter(
                              (todo: any) => todo.status === "in_progress",
                            )
                            .map((todo: any, index: number) => (
                              <Task key={`todo-${index}`} className="my-2">
                                <TaskTrigger title={todo.activeForm} />
                                <TaskContent>
                                  {toolParts.map((part, toolIndex) => (
                                    <TaskItem key={`tool-${toolIndex}`}>
                                      {getToolTriggerContent(part)}
                                    </TaskItem>
                                  ))}
                                </TaskContent>
                              </Task>
                            ))}
                        </div>
                      )}
                  </div>
                );
              })
            ) : (
              <ConversationEmptyState
                title="No messages yet"
                description="Start a conversation with your sandbox"
              />
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <PromptInput onSubmit={handleSubmit} className="relative">
          <PromptInputBody>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputToolbar>
            <PromptInputTools />
            <PromptInputSubmit
              disabled={isSubmitting}
              status={isSubmitting ? "submitted" : "ready"}
            />
          </PromptInputToolbar>
        </PromptInput>
      </div>
      <div className="flex-1 min-h-0">
        <WebPreview defaultUrl={domain} className="h-full">
          <WebPreviewNavigation>
            <WebPreviewUrl src={domain} />
            <button
              onClick={handleDebugWorker}
              className="ml-2 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border"
              title="Debug worker (check console)"
            >
              Debug Worker
            </button>
          </WebPreviewNavigation>
          <WebPreviewBody src={domain} className="bg-white flex-1" />
        </WebPreview>
      </div>
    </div>
  );
}
