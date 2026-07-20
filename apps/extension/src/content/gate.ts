import { ExtensionMessageSchema } from "@flr/shared";

export interface ObserverPort {
  observe(target: Node, options: MutationObserverInit): void;
  disconnect(): void;
}

export interface ContentRuntime {
  body: Node | null;
  sendMessage(message: unknown): Promise<unknown>;
  scan(): Promise<void>;
  createObserver(callback: MutationCallback): ObserverPort;
  addMessageListener(listener: (message: unknown) => void): () => void;
}

export interface ContentGateResult {
  active: boolean;
  reason: "active" | "not_allowlisted" | "stopped" | "unavailable";
  stop(): void;
}

const sleeping = (reason: ContentGateResult["reason"]): ContentGateResult => ({
  active: false,
  reason,
  stop() {},
});

export const startContentGate = async (
  runtime: ContentRuntime,
): Promise<ContentGateResult> => {
  let response: unknown;
  try {
    response = await runtime.sendMessage({ type: "GET_GATE_STATE" });
  } catch {
    return sleeping("unavailable");
  }

  const parsed = ExtensionMessageSchema.safeParse(response);
  if (!parsed.success || parsed.data.type !== "GATE_STATE") {
    return sleeping("unavailable");
  }
  if (!parsed.data.allowlisted) return sleeping("not_allowlisted");
  if (
    parsed.data.systemState.emergencyStop ||
    parsed.data.systemState.circuitBreaker.state === "tripped"
  ) {
    return sleeping("stopped");
  }
  if (runtime.body === null) return sleeping("unavailable");

  let stopped = false;
  let scanning = false;
  let rescan = false;
  const scan = async (): Promise<void> => {
    if (stopped) return;
    if (scanning) {
      rescan = true;
      return;
    }
    scanning = true;
    try {
      do {
        rescan = false;
        await runtime.scan();
      } while (rescan && !stopped);
    } finally {
      scanning = false;
    }
  };

  await scan();
  const observer = runtime.createObserver(() => void scan());
  observer.observe(runtime.body, { childList: true, subtree: true });
  const removeListener = runtime.addMessageListener((message) => {
    const next = ExtensionMessageSchema.safeParse(message);
    if (
      next.success &&
      next.data.type === "EMERGENCY_STOP_CHANGED" &&
      next.data.enabled
    ) {
      stopped = true;
      observer.disconnect();
    }
  });

  return {
    active: true,
    reason: "active",
    stop() {
      stopped = true;
      observer.disconnect();
      removeListener();
    },
  };
};
