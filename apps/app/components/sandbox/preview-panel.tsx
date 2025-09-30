"use client";

import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewUrl,
  WebPreviewBody,
  WebPreviewNavigationButton,
} from "@/components/ai-elements/web-preview";
import { ExternalLinkIcon } from "lucide-react";
import { useRef, useState } from "react";

interface PreviewPanelProps {
  domain: string;
}

export function PreviewPanel({ domain }: PreviewPanelProps) {
  const [url, setUrl] = useState(domain);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="flex-1 min-h-0">
      <WebPreview
        defaultUrl={url}
        className="h-full rounded-lg overflow-hidden"
      >
        <WebPreviewNavigation>
          <WebPreviewUrl src={url} onChange={(e) => setUrl(e.target.value)} />
          <WebPreviewNavigationButton
            tooltip="Open in new tab"
            onClick={() => window.open(url, "_blank")}
          >
            <ExternalLinkIcon className="w-4 h-4" />
          </WebPreviewNavigationButton>
        </WebPreviewNavigation>
        <WebPreviewBody src={url} className="bg-white flex-1" ref={iframeRef} />
      </WebPreview>
    </div>
  );
}
