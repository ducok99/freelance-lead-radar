import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ExtensionMessageSchema,
  type ExtensionMessage,
  type Lead,
} from "@flr/shared";
import { chromeLocalStorage, readSystemState } from "../lib/storage";
import "../ui/styles.css";

const CLASSIFICATION_LABELS: Record<Lead["classification"], string> = {
  hiring_freelancer: "Đang thuê freelancer",
  seeking_work: "Người đăng tìm việc",
  fulltime_recruitment: "Tuyển full-time",
  ad_or_spam: "Quảng cáo / spam",
  other: "Khác",
};

const STATUS_LABELS: Record<Lead["status"], string> = {
  detected: "Đang xử lý",
  filtered_out: "Đã lọc",
  below_threshold: "Dưới ngưỡng",
  needs_review: "Cần duyệt",
  skipped: "Đã bỏ qua",
  approved: "Đã duyệt",
  comment_inserted: "Đã chèn nháp",
  commented: "Đã bình luận",
  assigned: "Đã phân công",
  won: "Đã chốt",
  lost: "Không chốt",
};

const send = async (message: ExtensionMessage): Promise<ExtensionMessage> => {
  const response: unknown = await chrome.runtime.sendMessage(message);
  const parsed = ExtensionMessageSchema.safeParse(response);
  if (!parsed.success) {
    return {
      type: "ACTION_ERROR",
      code: "unavailable",
      message: "Background không phản hồi. Hãy Reload extension.",
    };
  }
  return parsed.data;
};

interface LeadCardProps {
  lead: Lead;
  busy: boolean;
  onAction(message: ExtensionMessage): Promise<void>;
}

const LeadCard = ({ lead, busy, onAction }: LeadCardProps) => {
  const [draft, setDraft] = useState(
    lead.draft?.editedText ?? lead.draft?.aiText ?? "",
  );

  useEffect(() => {
    setDraft(lead.draft?.editedText ?? lead.draft?.aiText ?? "");
  }, [lead.draft?.aiText, lead.draft?.editedText]);

  const canReview =
    lead.status === "needs_review" && lead.processingError === undefined;

  return (
    <article className="lead-card" data-lead-status={lead.status}>
      <div className="row row--top">
        <div>
          <strong>{lead.extraction.jobSummary}</strong>
          <p className="muted">
            {CLASSIFICATION_LABELS[lead.classification]} ·{" "}
            {STATUS_LABELS[lead.status]}
            {lead.post.postedAtText !== undefined
              ? ` · Đăng ${lead.post.postedAtText}`
              : ""}
          </p>
        </div>
        <span className="score">{lead.score}</span>
      </div>

      <div className="breakdown" aria-label="Chi tiết điểm">
        <span>Ý định {lead.scoreBreakdown.intent}</span>
        <span>Ngân sách {lead.scoreBreakdown.budget}</span>
        <span>Khớp team {lead.scoreBreakdown.fieldMatch}</span>
        <span>Gấp {lead.scoreBreakdown.urgency}</span>
        <span>Liên hệ {lead.scoreBreakdown.contact}</span>
        <span>Chất lượng {lead.scoreBreakdown.quality}</span>
      </div>

      {lead.filterReasons.length > 0 ? (
        <p className="notice notice--warning">
          Lý do lọc: {lead.filterReasons.join(", ")}
        </p>
      ) : null}

      {lead.processingError !== undefined ? (
        <div className="notice notice--danger">
          <strong>Chưa xử lý xong:</strong> {lead.processingError.message}
          {lead.processingError.retryable ? (
            <button
              className="button button--secondary button--small"
              disabled={busy}
              onClick={() =>
                void onAction({ type: "RETRY_LEAD", leadId: lead.id })
              }
              type="button"
            >
              Thử lại
            </button>
          ) : null}
        </div>
      ) : null}

      {lead.draft !== undefined ? (
        <label>
          Nháp AI — sửa trước khi duyệt
          <textarea
            disabled={busy || lead.status !== "needs_review"}
            maxLength={2_000}
            onChange={(event) => setDraft(event.target.value)}
            value={draft}
          />
        </label>
      ) : null}

      {lead.status === "needs_review" ? (
        <div className="actions">
          <button
            className="button button--secondary"
            disabled={busy || draft.trim().length === 0}
            onClick={() =>
              void onAction({
                type: "EDIT_LEAD_DRAFT",
                leadId: lead.id,
                text: draft,
              })
            }
            type="button"
          >
            Lưu nháp
          </button>
          <button
            className="button"
            disabled={busy || !canReview}
            onClick={() =>
              void onAction({
                type: "REVIEW_LEAD",
                leadId: lead.id,
                action: "approve",
              })
            }
            type="button"
          >
            Duyệt lead
          </button>
          <button
            className="button button--secondary"
            disabled={busy}
            onClick={() =>
              void onAction({
                type: "REVIEW_LEAD",
                leadId: lead.id,
                action: "skip",
              })
            }
            type="button"
          >
            Bỏ qua
          </button>
        </div>
      ) : null}
      <a href={lead.post.permalink} rel="noreferrer" target="_blank">
        Mở bài gốc
      </a>
    </article>
  );
};

const SidePanel = () => {
  const [stopped, setStopped] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tab, setTab] = useState<"queue" | "filtered">("queue");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void readSystemState(chromeLocalStorage).then((state) =>
      setStopped(state.emergencyStop),
    );
    void send({ type: "GET_LEADS" }).then((message) => {
      if (message.type === "LEADS_UPDATED") setLeads(message.leads);
    });
    const listener = (input: unknown) => {
      const message = ExtensionMessageSchema.safeParse(input);
      if (!message.success) return;
      if (message.data.type === "EMERGENCY_STOP_CHANGED") {
        setStopped(message.data.enabled);
      }
      if (message.data.type === "LEADS_UPDATED") setLeads(message.data.leads);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const visible = useMemo(
    () =>
      leads.filter((lead) =>
        tab === "filtered"
          ? ["filtered_out", "below_threshold", "skipped"].includes(lead.status)
          : !["filtered_out", "below_threshold", "skipped"].includes(
              lead.status,
            ),
      ),
    [leads, tab],
  );

  const action = async (message: ExtensionMessage) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await send(message);
      if (response.type === "LEADS_UPDATED") setLeads(response.leads);
      if (response.type === "ACTION_ERROR") setError(response.message);
    } catch {
      setError("Không kết nối được background. Hãy Reload extension.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app">
      <header className="brand">
        <span className="brand__mark">FL</span>
        <div>
          <h1>Hàng đợi lead</h1>
          <p className="muted">P6 chỉ đọc · con người duyệt</p>
        </div>
      </header>
      {stopped ? (
        <div className="notice notice--danger">
          Emergency Stop đang bật. Toàn bộ pipeline đã dừng.
        </div>
      ) : null}
      {error ? (
        <div aria-live="assertive" className="notice notice--danger">
          {error}
        </div>
      ) : null}
      <div className="tabs">
        <button
          className={`button ${tab === "queue" ? "" : "button--secondary"}`}
          onClick={() => setTab("queue")}
          type="button"
        >
          Hàng đợi (
          {
            leads.filter(
              (lead) =>
                !["filtered_out", "below_threshold", "skipped"].includes(
                  lead.status,
                ),
            ).length
          }
          )
        </button>
        <button
          className={`button ${tab === "filtered" ? "" : "button--secondary"}`}
          onClick={() => setTab("filtered")}
          type="button"
        >
          Đã lọc (
          {
            leads.filter((lead) =>
              ["filtered_out", "below_threshold", "skipped"].includes(
                lead.status,
              ),
            ).length
          }
          )
        </button>
      </div>
      {visible.length === 0 ? (
        <section className="card empty">
          <strong>
            {tab === "queue" ? "Chưa có lead" : "Chưa có bài bị lọc"}
          </strong>
          <p className="muted">
            Mở một nhóm trong allowlist để P6 đọc các bài đang hiển thị.
          </p>
        </section>
      ) : (
        <section className="lead-list">
          {visible.map((lead) => (
            <LeadCard busy={busy} key={lead.id} lead={lead} onAction={action} />
          ))}
        </section>
      )}
      <p className="muted safety-copy">
        P6 không chèn, click hoặc đăng bình luận lên Facebook.
      </p>
    </main>
  );
};

createRoot(document.querySelector("#root")!).render(
  <StrictMode>
    <SidePanel />
  </StrictMode>,
);
