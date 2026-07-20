import type { Lead, Settings } from "@flr/shared";

/**
 * P6.1 — Thông báo desktop khi có lead mới vào hàng đợi duyệt (DUC yêu cầu &
 * duyệt 2026-07-20; SECURITY.md §4).
 *
 * Ranh giới an toàn (giữ nguyên ADR-01 đọc thụ động): thông báo CHỈ phát sinh
 * khi pipeline vừa phân tích xong một bài mà người dùng đang thật sự nhìn
 * thấy trong tab nhóm allowlist. Extension không tự quét nền để "tìm" lead —
 * không có tab nhóm đang mở thì không có gì để thông báo. Mọi điều hướng sau
 * đó (mở bài viết) đều do NGƯỜI DÙNG bấm vào thông báo.
 */

/** Nhiều hơn số này trong một batch → gộp thành một thông báo tổng cho đỡ ồn. */
export const MAX_INDIVIDUAL_NOTIFICATIONS = 3 as const;
/** Độ dài tối đa phần nội dung hiển thị trong thông báo. */
export const NOTIFICATION_MESSAGE_MAX_LENGTH = 120 as const;
/** Tiền tố id để handler click nhận ra thông báo lead của extension. */
export const LEAD_NOTIFICATION_ID_PREFIX = "flr-lead:" as const;
/** Id của thông báo tổng khi một batch có nhiều lead. */
export const SUMMARY_NOTIFICATION_ID = "flr-lead-summary" as const;

export interface LeadNotification {
  id: string;
  title: string;
  message: string;
}

const truncate = (text: string, maxLength: number): string => {
  const trimmed = text.trim();
  return trimmed.length <= maxLength
    ? trimmed
    : `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
};

const groupName = (lead: Lead, settings: Settings): string =>
  settings.allowlist.find((group) => group.groupId === lead.post.groupId)
    ?.name ?? "nhóm Facebook";

/** Chỉ lead vừa vào hàng đợi duyệt mới đáng thông báo. */
export const selectNotifiableLeads = (leads: readonly Lead[]): Lead[] =>
  leads.filter((lead) => lead.status === "needs_review");

export const buildLeadNotifications = (
  leads: readonly Lead[],
  settings: Settings,
): LeadNotification[] => {
  const notifiable = selectNotifiableLeads(leads);
  if (notifiable.length === 0) return [];
  if (notifiable.length > MAX_INDIVIDUAL_NOTIFICATIONS) {
    return [
      {
        id: SUMMARY_NOTIFICATION_ID,
        title: `${notifiable.length} lead mới chờ duyệt`,
        message: truncate(
          notifiable
            .map((lead) => `${lead.score}đ ${lead.extraction.jobSummary}`)
            .join(" · "),
          NOTIFICATION_MESSAGE_MAX_LENGTH,
        ),
      },
    ];
  }
  return notifiable.map((lead) => ({
    id: `${LEAD_NOTIFICATION_ID_PREFIX}${lead.post.postKey}`,
    title: `Lead ${lead.score} điểm — ${groupName(lead, settings)}`,
    message: truncate(
      lead.extraction.jobSummary,
      NOTIFICATION_MESSAGE_MAX_LENGTH,
    ),
  }));
};

export type NotificationTarget =
  { kind: "lead"; postKey: string } | { kind: "summary" };

/** Dịch id thông báo được bấm thành đích cần mở; id lạ → null (bỏ qua). */
export const notificationTarget = (
  notificationId: string,
): NotificationTarget | null => {
  if (notificationId === SUMMARY_NOTIFICATION_ID) return { kind: "summary" };
  if (notificationId.startsWith(LEAD_NOTIFICATION_ID_PREFIX)) {
    const postKey = notificationId.slice(LEAD_NOTIFICATION_ID_PREFIX.length);
    return postKey.length > 0 ? { kind: "lead", postKey } : null;
  }
  return null;
};

export interface LeadNotifierDeps {
  getSettings: () => Promise<Settings>;
  show: (notification: LeadNotification) => Promise<void>;
}

/**
 * Tạo hàm `notify` cho ReadOnlyPipelinePorts. Đọc settings MỚI NHẤT ở mỗi
 * lần gọi để việc tắt thông báo trong Options có hiệu lực ngay lập tức.
 */
export const createLeadNotifier =
  (deps: LeadNotifierDeps) =>
  async (leads: readonly Lead[]): Promise<void> => {
    const settings = await deps.getSettings();
    if (!settings.notifications.enabled) return;
    for (const notification of buildLeadNotifications(leads, settings)) {
      await deps.show(notification);
    }
  };
