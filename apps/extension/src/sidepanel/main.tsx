import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ExtensionMessageSchema } from "@flr/shared";
import { chromeLocalStorage, readSystemState } from "../lib/storage";
import "../ui/styles.css";

const SidePanel = () => {
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    void readSystemState(chromeLocalStorage).then((state) =>
      setStopped(state.emergencyStop),
    );
    const listener = (input: unknown) => {
      const message = ExtensionMessageSchema.safeParse(input);
      if (message.success && message.data.type === "EMERGENCY_STOP_CHANGED") {
        setStopped(message.data.enabled);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  return (
    <main className="app">
      <header className="brand">
        <span className="brand__mark">FL</span>
        <div>
          <h1>Hàng đợi lead</h1>
          <p className="muted">Duyệt thủ công trước mọi hành động</p>
        </div>
      </header>
      {stopped ? (
        <div className="notice notice--danger">
          Emergency Stop đang bật. Toàn bộ pipeline đã dừng.
        </div>
      ) : null}
      <section className="card empty">
        <strong>Chưa có lead</strong>
        <p className="muted">
          P5 chỉ dựng khung an toàn. Pipeline đọc bài và gọi AI chỉ được nối ở
          P6 sau khi P5 được duyệt.
        </p>
      </section>
    </main>
  );
};

createRoot(document.querySelector("#root")!).render(
  <StrictMode>
    <SidePanel />
  </StrictMode>,
);
