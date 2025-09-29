// Base UIMessage types following Vercel AI SDK standard
export interface UIMessagePart {
  type: string;
  [key: string]: any;
}

export interface BaseUIMessage {
  id: string;
  role: "system" | "user" | "assistant";
  parts: UIMessagePart[];
  metadata?: Record<string, any>;
}

// Custom metadata type for our application
export interface AppMetadata {
  timestamp?: string;
  source?: string;
  [key: string]: any;
}

// Our custom UIMessage type
export type AppUIMessage = BaseUIMessage & {
  metadata?: AppMetadata;
};
