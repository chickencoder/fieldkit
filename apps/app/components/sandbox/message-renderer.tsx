"use client";

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
import { Response } from "@/components/ai-elements/response";

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

interface MessageRendererProps {
  messages: MessageData[];
}

const getToolTriggerContent = (part: { name: string; input?: Record<string, unknown> }) => {
  const fileName = typeof part.input?.file_path === 'string' ? part.input.file_path.split("/").pop() : undefined;

  switch (part.name) {
    case "Glob":
      return (
        <span className="flex items-center gap-2">
          Searching for{" "}
          <TaskItemFile>
            {typeof part.input?.pattern === 'string' ? part.input.pattern : "files"}
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
      return `Running: ${typeof part.input?.command === 'string' ? part.input.command.slice(0, 40) : "bash"}${typeof part.input?.command === 'string' && part.input.command.length > 40 ? "..." : ""}`;
    case "Grep":
      return (
        <span className="flex items-center gap-2">
          Searching for{" "}
          <TaskItemFile>
            {typeof part.input?.pattern === 'string' ? part.input.pattern : "pattern"}
          </TaskItemFile>
        </span>
      );
    case "Task":
      return typeof part.input?.description === 'string' ? part.input.description : "Running task";
    case "WebFetch":
      return `Fetching ${typeof part.input?.url === 'string' ? part.input.url : "web content"}`;
    case "WebSearch":
      return (
        <span className="flex items-center gap-2">
          Web search:{" "}
          <TaskItemFile>
            {typeof part.input?.query === 'string' ? part.input.query : "query"}
          </TaskItemFile>
        </span>
      );
    default:
      return `${part.name}`;
  }
};

export function MessageRenderer({ messages }: MessageRendererProps) {
  return (
    <>
      {messages.map((message) => {
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
                      : "/claude.png"
                  }
                  name={message.role === "user" ? "User" : "Assistant"}
                  className="size-6 ring-0"
                />
              </Message>
            )}

            {(() => {
              if (
                latestTodoWrite &&
                typeof latestTodoWrite === 'object' &&
                latestTodoWrite.input?.todos &&
                toolParts.length > 0
              ) {
                return (
                  <div className="mb-2">
                    {(latestTodoWrite.input.todos as { status: string; activeForm: string }[])
                      .filter(
                        (todo: { status: string }) => todo.status === "in_progress",
                      )
                      .map((todo: { activeForm: string }, index: number) => (
                        <Task key={`todo-${index}`} className="my-2">
                          <TaskTrigger title={todo.activeForm} />
                          <TaskContent>
                            {toolParts.map((part, toolIndex) => (
                              <TaskItem key={`tool-${toolIndex}`}>
                                {part.name ? getToolTriggerContent(part as { name: string; input?: Record<string, unknown> }) : null}
                              </TaskItem>
                            ))}
                          </TaskContent>
                        </Task>
                      ))}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        );
      })}
    </>
  );
}