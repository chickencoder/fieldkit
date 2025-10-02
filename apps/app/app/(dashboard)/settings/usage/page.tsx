"use client";

export default function UsageSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-6">Usage</h2>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">API Calls</p>
              <p className="text-2xl font-semibold">0</p>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Storage</p>
              <p className="text-2xl font-semibold">0 MB</p>
              <p className="text-xs text-muted-foreground mt-1">Used</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Projects</p>
              <p className="text-2xl font-semibold">0</p>
              <p className="text-xs text-muted-foreground mt-1">Active</p>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground text-center">
              Usage tracking coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
