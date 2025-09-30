"use client";

import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewUrl,
  WebPreviewBody,
} from "@/components/ai-elements/web-preview";

interface PreviewPanelProps {
  domain: string;
}

export function PreviewPanel({ domain }: PreviewPanelProps) {
  return (
    <div className="flex-1 min-h-0">
      <WebPreview
        defaultUrl={domain}
        className="h-full rounded-lg overflow-hidden"
      >
        <WebPreviewNavigation>
          <WebPreviewUrl src={domain} />
        </WebPreviewNavigation>
        <WebPreviewBody src={domain} className="bg-white flex-1" />
      </WebPreview>
    </div>
  );
}
