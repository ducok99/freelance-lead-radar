import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ExtensionMessageSchema,
  type CounterState,
  type SystemState,
  type WarningReason,
} from "@flr/shared";
import { groupIsAllowlisted } from "../background/controller";
import {
  chromeLocalStorage,
  readCounters,
  readSettings,
  readSystemState,
} from "../lib/storage";
import "../ui/styles.css";

// P6.7: nhãn tiếng Việt cho lý do cầu dao an toàn tự ngắt.
const WARNING_REASON_LABELS: Record<WarningReason, string> = {
  captcha_detected: "phát hiện CAPTCHA",
  checkpoint_detected: "Facebook yêu cầu xác minh (checkpoint)",
  temporarily_blocked: "Facebook báo tạm thời bị chặn",
  login_redirect: "bị đưa về trang đăng nhập",
  facebook_warning: "Facebook hiển thị cảnh báo",
  unknown_warning: "tín hiệu bất thường không xác định",
};

const Popup = () => {
  const [state, setState] = useState<SystemState | null>(null);
  const [counters, setCounters] = useState<CounterState | null>(null);
  const [allowlisted, setAllowlisted] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [actionError, setActionError] = useState("");

  const reload = async () => {
    const [settings, nextState, nextCounters, tabs] = await Promise.all([
      readSettings(chromeLocalStorage),
      readSystemState(chromeLocalStorage),
      readCounters(chromeLocalStorage, new Date()),
      chrome.tabs.query({ active: true, currentWindow: true }),
    ]);
    setState(nextState);
    setCounters(nextCounters);
    setAllowlisted(groupIsAllowlisted(tabs[0]?.url, settings));
  };

  useEffect(() => void reload(), []);

  const toggleStop = async () => {
    if (state === null || isToggling) return;
    const expected = !state.emergencyStop;
    setIsToggling(true);
    setActionError("");
    try {
      const response: unknown = await chrome.runtime.sendMessage({
        type: "SET_EMERGENCY_STOP",
        enabled: expected,
      });
      const parsed = ExtensionMessageSchema.safeParse(response);
      if (
        !parsed.success ||
        parsed.data.type !== "EMERGENCY_STOP_CHANGED" ||
        parsed.data.enabled !== expected
      ) {
        throw new Error("Background không xác nhận trạng thái mới");
      }
      await reload();
    } catch {
      setActionError(
        "Không đổi được trạng thái. Hãy Reload extension tại chrome://extensions.",
      );
    } finally {
      setIsToggling(false);
    }
  };

  // P6.7: trước đây KHÔNG có nút nào gửi RESET_CIRCUIT_BREAKER — cầu dao đã
  // ngắt (kể cả do báo động giả) là hệ thống đứng im vĩnh viễn, "Bật lại hệ
  // thống" chỉ tắt Emergency Stop chứ không đóng lại cầu dao. Nút này bổ sung
  // đường hồi phục THỦ CÔNG đúng thiết kế SECURITY (con người chủ động reset
  // sau khi đã kiểm tra tài khoản).
  const resetBreaker = async () => {
    if (isToggling) return;
    setIsToggling(true);
    setActionError("");
    try {
      const response: unknown = await chrome.runtime.sendMessage({
        type: "RESET_CIRCUIT_BREAKER",
      });
      const parsed = ExtensionMessageSchema.safeParse(response);
      if (!parsed.success || parsed.data.type !== "GATE_STATE") {
        throw new Error("Background không xác nhận reset");
      }
      await reload();
    } catch {
      setActionError(
        "Không reset được cầu dao. Hãy Reload extension tại chrome://extensions.",
      );
    } finally {
      setIsToggling(false);
    }
  };

  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id === undefined) return;
    await chrome.sidePanel.open({ tabId: tab.id });
    globalThis.close();
  };

  const breaker = state?.circuitBreaker;
  const stopped = state?.emergencyStop === true || breaker?.state === "tripped";

  return (
    <main className="app">
      <header className="brand">
        <span className="brand__mark">FL</span>
        <div>
          <h1>Freelance Lead Radar</h1>
          <p className="muted">Khung an toàn P5</p>
        </div>
      </header>

      <section className="card">
        <div className="row">
          <h2>Trạng thái</h2>
          <span className={`status ${stopped ? "status--danger" : ""}`}>
            {stopped ? "ĐÃ DỪNG" : "SẴN SÀNG"}
          </span>
        </div>
        <p className="muted">
          Nhóm hiện tại:{" "}
          {allowlisted ? "Trong allowlist" : "Không được theo dõi"}
        </p>
        {actionError ? (
          <div aria-live="assertive" className="notice notice--danger">
            {actionError}
          </div>
        ) : null}
        {breaker?.state === "tripped" ? (
          <div className="notice notice--danger">
            Cầu dao an toàn đã tự ngắt: {WARNING_REASON_LABELS[breaker.reason]}.
            Hãy mở Facebook kiểm tra tài khoản bình thường rồi mới bật lại.
            <button
              className="button button--secondary button--small"
              disabled={isToggling}
              onClick={() => void resetBreaker()}
              type="button"
            >
              Đã kiểm tra — đóng lại cầu dao
            </button>
          </div>
        ) : null}
        <button
          className={`button ${state?.emergencyStop ? "" : "button--danger"}`}
          disabled={isToggling}
          onClick={() => void toggleStop()}
          type="button"
        >
          {isToggling
            ? "Đang cập nhật..."
            : state?.emergencyStop
              ? "Bật lại hệ thống"
              : "Emergency Stop"}
        </button>
      </section>

      <section className="card">
        <h2>Hôm nay</h2>
        <div className="row">
          <span className="muted">AI calls</span>
          <strong>{counters?.aiCalls ?? 0}</strong>
        </div>
        <div className="row">
          <span className="muted">Bình luận đã chèn</span>
          <strong>{counters?.commentsInserted ?? 0}</strong>
        </div>
      </section>

      <div className="row">
        <button
          className="button"
          onClick={() => void openSidePanel()}
          type="button"
        >
          Mở hàng đợi
        </button>
        <button
          className="button button--secondary"
          onClick={() => void chrome.runtime.openOptionsPage()}
          type="button"
        >
          Cài đặt
        </button>
      </div>
      <span className="muted">P6 đang chạy ở chế độ chỉ đọc</span>
    </main>
  );
};

createRoot(document.querySelector("#root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
