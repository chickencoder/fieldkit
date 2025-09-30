"use client";

import {
  Message,
  MessageContent,
  MessageAvatar,
} from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskItemFile,
  TaskTrigger,
} from "@/components/ai-elements/task";
import {
  FileIcon,
  SearchIcon,
  EditIcon,
  CodeIcon,
  GlobeIcon,
  FileSearchIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MessagePart {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  id?: string;
}

interface MessageData {
  _id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
}

interface MessageRendererProps {
  messages: MessageData[];
}

const GENERIC_ACTIVE_PHRASES = [
  "Cooking up some code...",
  "Spinning up the hamster wheels...",
  "Channeling my inner wizard...",
  "Putting on my thinking cap...",
  "Consulting the ancient scrolls...",
  "Doing the thing...",
  "Making the magic happen...",
  "Summoning the bits and bytes...",
  "Weaving the code tapestry...",
  "Building digital dreams...",
];

const getRandomPhrase = (seed: string) => {
  // Use a simple hash of the seed to get consistent random selection
  const hash = seed
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return GENERIC_ACTIVE_PHRASES[hash % GENERIC_ACTIVE_PHRASES.length];
};

const getToolDescription = (part: {
  name: string;
  input?: Record<string, unknown>;
}) => {
  const fileName =
    typeof part.input?.file_path === "string"
      ? part.input.file_path.split("/").pop()
      : undefined;

  switch (part.name) {
    case "Glob":
      return (
        <span className="flex items-center gap-2">
          Searching for{" "}
          <TaskItemFile>
            {typeof part.input?.pattern === "string"
              ? part.input.pattern
              : "files"}
          </TaskItemFile>
        </span>
      );
    case "Read":
      return (
        <span className="flex items-center gap-2">
          Reading <TaskItemFile>{fileName || "file"}</TaskItemFile>
        </span>
      );
    case "Edit":
      return (
        <span className="flex items-center gap-2">
          Editing <TaskItemFile>{fileName || "file"}</TaskItemFile>
        </span>
      );
    case "Write":
      return (
        <span className="flex items-center gap-2">
          Writing <TaskItemFile>{fileName || "file"}</TaskItemFile>
        </span>
      );
    case "Bash":
      const cmd =
        typeof part.input?.command === "string" ? part.input.command : "bash";
      return (
        <span className="flex items-center gap-2">
          Running{" "}
          <TaskItemFile>
            {cmd.length > 40 ? `${cmd.slice(0, 40)}...` : cmd}
          </TaskItemFile>
        </span>
      );
    case "Grep":
      return (
        <span className="flex items-center gap-2">
          Searching for{" "}
          <TaskItemFile>
            {typeof part.input?.pattern === "string"
              ? part.input.pattern
              : "pattern"}
          </TaskItemFile>
        </span>
      );
    case "Task":
      return typeof part.input?.description === "string"
        ? part.input.description
        : "Running task";
    case "WebFetch":
      return (
        <span className="flex items-center gap-2">
          Fetching{" "}
          <TaskItemFile>
            {typeof part.input?.url === "string"
              ? part.input.url
              : "web content"}
          </TaskItemFile>
        </span>
      );
    case "WebSearch":
      return (
        <span className="flex items-center gap-2">
          Searching:{" "}
          <TaskItemFile>
            {typeof part.input?.query === "string" ? part.input.query : "query"}
          </TaskItemFile>
        </span>
      );
    default:
      return part.name;
  }
};

export function MessageRenderer({ messages }: MessageRendererProps) {
  return (
    <>
      {messages.map((message) => {
        const todoWrite = message.parts.find(
          (part) => part.type === "tool_use" && part.name === "TodoWrite",
        );

        const todos = todoWrite?.input?.todos as
          | { status: string; activeForm: string; content: string }[]
          | undefined;
        const inProgressTodo = todos?.find((t) => t.status === "in_progress");

        let hasRenderedTask = false;

        return (
          <div key={message._id}>
            <Message from="system">
              <MessageContent variant="flat">
                <div className="inline-flex items-center gap-2">
                  <MessageAvatar
                    src={
                      message.role === "user"
                        ? "https://static.landing.so/avatars/male-1.png"
                        : "/claude.png"
                    }
                    name={message.role === "user" ? "User" : "Assistant"}
                    className="size-4 ring-0"
                  />
                  <span className="font-medium">
                    {message.role === "user" ? "Jesse" : "Claude"}
                  </span>
                </div>

                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return <Response key={index}>{part.text}</Response>;
                  } else if (
                    part.type === "tool_use" &&
                    part.name !== "TodoWrite" &&
                    !hasRenderedTask
                  ) {
                    hasRenderedTask = true;
                    const toolParts = message.parts.filter(
                      (p) => p.type === "tool_use" && p.name !== "TodoWrite",
                    );

                    return (
                      <Task key={index} className="my-2">
                        <TaskTrigger
                          title={
                            inProgressTodo?.activeForm ||
                            getRandomPhrase(message._id)
                          }
                        />
                        <TaskContent>
                          {toolParts.map((toolPart, toolIndex) => (
                            <TaskItem key={toolIndex}>
                              {getToolDescription(
                                toolPart as {
                                  name: string;
                                  input?: Record<string, unknown>;
                                },
                              )}
                            </TaskItem>
                          ))}
                        </TaskContent>
                      </Task>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          </div>
        );
      })}
    </>
  );
}
