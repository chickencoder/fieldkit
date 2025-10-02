"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

type EnvVar = {
  id: string;
  key: string;
  value: string;
};

export default function EnvironmentSettingsPage() {
  const [envVars, setEnvVars] = useState<EnvVar[]>([
    { id: "1", key: "", value: "" },
  ]);

  const addEnvVar = () => {
    setEnvVars([...envVars, { id: Date.now().toString(), key: "", value: "" }]);
  };

  const removeEnvVar = (id: string) => {
    if (envVars.length === 1) return;
    setEnvVars(envVars.filter((env) => env.id !== id));
  };

  const updateEnvVar = (id: string, field: "key" | "value", value: string) => {
    setEnvVars(
      envVars.map((env) => (env.id === id ? { ...env, [field]: value } : env)),
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Environment Variables</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Manage environment variables for your project
        </p>

        <div className="space-y-4">
          <div className="space-y-3">
            {envVars.map((env) => (
              <div key={env.id} className="flex gap-3 items-start">
                <div className="flex-1">
                  <Input
                    placeholder="KEY"
                    value={env.key}
                    onChange={(e) =>
                      updateEnvVar(env.id, "key", e.target.value)
                    }
                  />
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="value"
                    value={env.value}
                    onChange={(e) =>
                      updateEnvVar(env.id, "value", e.target.value)
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeEnvVar(env.id)}
                  disabled={envVars.length === 1}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <Button variant="outline" onClick={addEnvVar}>
              <Plus className="h-4 w-4 mr-2" />
              Add Variable
            </Button>
            <Button>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
