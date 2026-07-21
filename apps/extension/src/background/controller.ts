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
  pipeline: {
    enqueue(
      post: Extract<ExtensionMessage, { type: "POST_SEEN" }>["post"],
    ): Promise<void>;
    recordExtractionFailure(): Promise<void>;
    recordSystemAudit(
      action:
        | "emergency_stop_on"
        | "emergency_stop_off"
        | "circuit_tripped"
        | "circuit_reset",
      detail?: Record<string, unknown>,
    ): Promise<void>;
    listLeads(): Promise<
      Extract<ExtensionMessage, { type: "LEADS_UPDATED" }>["leads"]
    >;
    reviewLead(
      leadId: string,
      action: "approve" | "skip",
    ): Promise<{
      ok: boolean;
      code?: "not_found" | "invalid_state" | "unavailable";
      message?: string;
      leads: Extract<ExtensionMessage, { type: "LEADS_UPDATED" }>["leads"];
    }>;
    editDraft(
      leadId: string,
      text: string,
    ): Promise<{
      ok: boolean;
      code?: "not_found" | "invalid_state" | "unavailable";
      message?: string;
      leads: Extract<ExtensionMessage, { type: "LEADS_UPDATED" }>["leads"];
    }>;
    retryLead(leadId: string): Promise<{
      ok: boolean;
      code?: "not_found" | "invalid_state" | "unavailable";
      message?: string;
      leads: Extract<ExtensionMessage, { type: "LEADS_UPDATED" }>["leads"];
    }>;
  };
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

const actionResponse = async (
  action: Promise<{
    ok: boolean;
    code?: "not_found" | "invalid_state" | "unavailable";
    message?: string;
    leads: Extract<ExtensionMessage, { type: "LEADS_UPDATED" }>["leads"];
  }>,
): Promise<ExtensionMessage> => {
  const result = await action;
  return result.ok
    ? { type: "LEADS_UPDATED", leads: result.leads }
    : {
        type: "ACTION_ERROR",
        code: result.code ?? "unavailable",
        message: result.message ?? "Không thực hiện được thao tác.",
      };
};

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
    await ports.pipeline.recordSystemAudit(
      state.emergencyStop ? "emergency_stop_on" : "emergency_stop_off",
    );
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
    await ports.pipeline.recordSystemAudit("circuit_tripped", {
      reason: message.reason,
    });
    return changed;
  }

  if (message.type === "RESET_CIRCUIT_BREAKER") {
    const current = await readSystemState(ports.storage);
    const state = await writeSystemState(ports.storage, {
      ...current,
      circuitBreaker: { state: "armed" },
    });
    const settings = await readSettings(ports.storage);
    await ports.pipeline.recordSystemAudit("circuit_reset");
    return gateStateMessage(senderUrl, settings, state);
  }

  if (message.type === "POST_SEEN") {
    const [settings, state] = await Promise.all([
      readSettings(ports.storage),
      readSystemState(ports.storage),
    ]);
    const senderGroupId =
      senderUrl === undefined ? null : extractGroupId(senderUrl);
    // P6.7: trước đây bài bị bỏ qua HOÀN TOÀN im lặng — không thể chẩn đoán
    // "content script gửi rồi mà sao không có lead". Ghi rõ lý do vào console
    // của service worker (chỉ lý do + nhóm, không ghi nội dung bài).
    const dropReason = !groupIsAllowlisted(senderUrl, settings)
      ? "nhóm của tab không nằm trong allowlist"
      : senderGroupId !== message.post.groupId
        ? "bài không thuộc nhóm của tab đang mở"
        : state.emergencyStop
          ? "Emergency Stop đang bật"
          : state.circuitBreaker.state === "tripped"
            ? "cầu dao an toàn đang ngắt"
            : null;
    if (dropReason !== null) {
      console.info(`[FLR] Nền bỏ qua bài: ${dropReason}.`);
      return undefined;
    }
    await ports.pipeline.enqueue(message.post);
    return undefined;
  }

  if (message.type === "EXTRACTION_FAILED") {
    const settings = await readSettings(ports.storage);
    if (!groupIsAllowlisted(senderUrl, settings)) return undefined;
    await ports.pipeline.recordExtractionFailure();
    return undefined;
  }

  if (message.type === "GET_LEADS") {
    return { type: "LEADS_UPDATED", leads: await ports.pipeline.listLeads() };
  }

  if (message.type === "REVIEW_LEAD") {
    return actionResponse(
      ports.pipeline.reviewLead(message.leadId, message.action),
    );
  }

  if (message.type === "EDIT_LEAD_DRAFT") {
    return actionResponse(
      ports.pipeline.editDraft(message.leadId, message.text),
    );
  }

  if (message.type === "RETRY_LEAD") {
    return actionResponse(ports.pipeline.retryLead(message.leadId));
  }

  // INSERT_COMMENT và COMMENT_CONFIRMED chỉ được xử lý ở P7.
  return undefined;
};
