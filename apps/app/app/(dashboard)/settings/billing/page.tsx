"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function BillingSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-6">Billing</h2>

        <div className="space-y-6">
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Current Plan</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  You are currently on the Free plan
                </p>
              </div>
              <Badge variant="outline">Free</Badge>
            </div>
            <Button>Upgrade Plan</Button>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Payment Method</h3>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No payment method on file
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Billing History</h3>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No billing history yet
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
