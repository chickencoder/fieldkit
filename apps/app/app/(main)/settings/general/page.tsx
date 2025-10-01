"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function GeneralSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-6">General</h2>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-2">
            <label className="text-sm font-medium">Organization Name</label>
            <Input placeholder="My Organization" />
            <p className="text-sm text-muted-foreground">
              The name of your organization
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <label className="text-sm font-medium">Organization Slug</label>
            <Input placeholder="my-organization" />
            <p className="text-sm text-muted-foreground">
              A unique identifier for your organization
            </p>
          </div>

          <div className="pt-4">
            <Button>Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
