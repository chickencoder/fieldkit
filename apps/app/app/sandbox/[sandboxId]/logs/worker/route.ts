import { NextRequest, NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  const { sandboxId } = await params;

  if (!sandboxId) {
    return NextResponse.json(
      { error: "Sandbox ID is required" },
      { status: 400 }
    );
  }

  try {
    // Get the existing sandbox instance
    const sandbox = await Sandbox.get({ sandboxId });

    // Run the command to read the log file
    const logsCommand = "if [ -f /tmp/worker.log ]; then cat /tmp/worker.log; else echo 'No worker logs found'; fi";
    const result = await sandbox.runCommand("bash", ["-c", logsCommand]);

    // Get the stdout
    let logs = "";
    try {
      logs = await result.stdout();
    } catch (error) {
      console.warn("Failed to read stdout:", error);
      logs = "Failed to read logs";
    }

    // Return logs as plain text for easy viewing
    return new NextResponse(logs, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to connect to sandbox or retrieve logs",
        sandboxId,
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}