"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function UsersSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-6">Users</h2>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Invite team members to collaborate on your projects
              </p>
            </div>
            <Button>Invite User</Button>
          </div>

          <div className="border rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No users yet. Invite your first team member to get started.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
