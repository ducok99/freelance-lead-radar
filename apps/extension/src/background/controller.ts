import {
  ExtensionMessageSchema,
  type ExtensionMessage,
  type Settings,
  type SystemState,
} from "@flr/shared";
import { extractGroupId } from "../lib/group-url";
import {
  type KeyValueStorage,
  readSettings,
  readSystemState,
  writeSystemState,
} from "../lib/storage";

export interface BackgroundPorts {
  storage: KeyValueStorage;
  now: () => Date;
  broadcast: (message: ExtensionMessage) => Promise<void>;
}

export const groupIsAllowlisted = (
  url: string | undefined,
  settings: Settings,
): boolean => {
  if (url === undefined) return false;
  const groupId = extractGroupId(url);
  return (
    groupId !== null &&
    settings.allowlist.some(
      (group) => group.active && group.groupId === groupId,
    )
  );
};

const gateStateMessage = (
  url: string | undefined,
  settings: Settings,
  systemState: SystemState,
): ExtensionMessage => ({
  type: "GATE_STATE",
  allowlisted: groupIsAllowlisted(url, settings),
  systemState,
});

export const handleBackgroundMessage = async (
  input: unknown,
  senderUrl: string | undefined,
  ports: BackgroundPorts,
): Promise<ExtensionMessage | undefined> => {
  const parsed = ExtensionMessageSchema.safeParse(input);
  if (!parsed.success) return undefined;

  const message = parsed.data;
  if (message.type === "GET_GATE_STATE") {
    const [settings, state] = await Promise.all([
      readSettings(ports.storage),
      readSystemState(ports.storage),
    ]);
    return gateStateMessage(senderUrl, settings, state);
  }

  if (message.type === "SET_EMERGENCY_STOP") {
    const current = await readSystemState(ports.storage);
    const state = await writeSystemState(ports.storage, {
      ...current,
      emergencyStop: message.enabled,
    });
    const changed: ExtensionMessage = {
      type: "EMERGENCY_STOP_CHANGED",
      enabled: state.emergencyStop,
    };
    await ports.broadcast(changed);
    return changed;
  }

  if (message.type === "WARNING_DETECTED") {
    const current = await readSystemState(ports.storage);
    const state = await writeSystemState(ports.storage, {
      ...current,
      emergencyStop: true,
      circuitBreaker: {
        state: "tripped",
        reason: message.reason,
        trippedAt: message.detectedAt,
      },
    });
    const changed: ExtensionMessage = {
      type: "EMERGENCY_STOP_CHANGED",
      enabled: state.emergencyStop,
    };
    await ports.broadcast(changed);
    return changed;
  }

  if (message.type === "RESET_CIRCUIT_BREAKER") {
    const current = await readSystemState(ports.storage);
    const state = await writeSystemState(ports.storage, {
      ...current,
      circuitBreaker: { state: "armed" },
    });
    const settings = await readSettings(ports.storage);
    return gateStateMessage(senderUrl, settings, state);
  }

  // P5 cố tình chưa xử lý POST_SEEN/lead/comment. Pipeline thuộc P6–P7.
  return undefined;
};
