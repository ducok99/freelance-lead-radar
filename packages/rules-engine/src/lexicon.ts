import type { Classification, SkillField } from "@flr/shared";

export type HeuristicClassification = Classification | "unknown";

const PATTERNS = {
  hiring: [
    /\bcan (?:thue|tim|tuyen)\b/,
    /\bthue (?:freelancer|team|designer|editor|dev|kien truc su)\b/,
    /\btim (?:ban|nguoi|team|freelancer|designer|editor|dev|kien truc su)\b/,
    /\bcan (?:ban|nguoi|team|freelancer|designer|editor|dev)\b/,
    /\bnho (?:ban|nguoi|team) .*\blam\b/,
    /\bco (?:job|du an|viec) .*\bcan\b/,
    /\b(?:budget|ngan sach|bao gia)\b/,
  ],
  seekingWork: [
    /\b(?:em|minh|toi|team minh) (?:dang )?nhan (?:job|viec|du an|thiet ke|dung|edit|lam web)\b/,
    /\bnhan (?:job|viec) (?:freelance|online|remote)\b/,
    /\b(?:em|minh|toi) dang tim (?:job|viec)\b/,
    /\bcan tim (?:job|viec lam)\b/,
    /\b(?:xin|ung tuyen) (?:job|viec|vi tri)\b/,
    /\bavailable for (?:work|job|freelance)\b/,
    /\bportfolio cua (?:em|minh|toi)\b/,
  ],
  fulltime: [
    /\btuyen (?:nhan vien|vi tri|designer|editor|lap trinh vien|kien truc su)\b/,
    /\b(?:full[ -]?time|toan thoi gian)\b/,
    /\b(?:lam|di lam) tai (?:van phong|cong ty)\b/,
    /\bgio hanh chinh\b/,
    /\b(?:gui|nop) cv\b/,
    /\bphong van\b/,
    /\b(?:luong|thu nhap) (?:thang|cung)\b/,
    /\b(?:ca truc|xoay ca|kpi|hop dong lao dong)\b/,
    /\bca \d{1,2}h(?:-| den )\d{1,2}h\b/,
  ],
  spamStrong: [
    /\bviec nhe luong cao\b/,
    /\bnap (?:tien|von)\b/,
    /\bthu nhap (?:tu )?\d+[km]? ?(?:\/|moi )?ngay\b/,
    /\bhoa hong (?:(?:cuc|rat) )?(?:cao|khung|hap dan)\b/,
    /\b(?:dau tu|kiem tien) online\b/,
    /\bchi can dien thoai .*(?:kiem tien|thu nhap).*(?:ngay|moi ngay)\b/,
    /\bco hoi cong tac .*\bib (?:de )?huong dan\b/,
  ],
  spamWeak: [
    /\bkhong can kinh nghiem\b/,
    /\bchi can dien thoai\b/,
    /\bib (?:de )?huong dan\b/,
  ],
  freeTrial: [
    /\b(?:lam|test|thu|demo|mau) .*\b(?:mien phi|free|khong luong|khong tra phi)\b/,
    /\b(?:mien phi|free) .*\b(?:test|mau|demo|lam thu)\b/,
  ],
  noOutsourcing: [
    /\bkhong (?:nhan|thue) (?:agency|team|doi nhom|ben ngoai)\b/,
    /\bkhong (?:outsource|thue ngoai)\b/,
    /\bchi (?:nhan|tuyen) (?:inhouse|nhan vien noi bo)\b/,
    /\bkhong lam viec voi (?:agency|team)\b/,
  ],
  ctvFreelance: [
    /\b(?:online|remote|tai nha)\b/,
    /\btra theo (?:bai|san pham|video|du an)\b/,
    /\b\d+[km] ?\/(?:bai|video|san pham)\b/,
  ],
} as const;

const FIELD_PATTERNS: Readonly<Record<SkillField, readonly RegExp[]>> = {
  graphic_design: [
    /\b(?:logo|banner|poster|an pham|bo nhan dien|thu moi)\b/,
    /\b(?:graphic|do hoa|photoshop|illustrator)\b/,
    /\bthiet ke (?:2d|hinh anh|bao bi|catalog|brochure)\b/,
  ],
  video_editing: [
    /\b(?:video|clip|tiktok|reels|youtube)\b/,
    /\b(?:edit|editor|dung phim|dung video|capcut|premiere|after effects)\b/,
  ],
  web_dev: [
    /\b(?:website|landing page|web app|frontend|backend|fullstack)\b/,
    /\b(?:react|wordpress|shopify|lap trinh web|code web)\b/,
  ],
  architecture: [
    /\b(?:kien truc|noi that|ngoai that|mat bang|phoi canh)\b/,
    /\b(?:3ds max|autocad|sketchup|revit|vray|corona)\b/,
  ],
  other: [/\b(?:content|marketing|seo|chay ads|truc page|sale|ke toan)\b/],
};

export const normalizeVietnameseText = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/giu, "d")
    .toLowerCase()
    .replace(/[^a-z0-9+#.$/%-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const matches = (text: string, patterns: readonly RegExp[]) =>
  patterns.some((pattern) => pattern.test(text));

export const hasFreeTrialRequirement = (text: string): boolean =>
  matches(normalizeVietnameseText(text), PATTERNS.freeTrial);

export const hasNoOutsourcingRequirement = (text: string): boolean =>
  matches(normalizeVietnameseText(text), PATTERNS.noOutsourcing);

export const detectSkillFields = (text: string): SkillField[] => {
  const normalized = normalizeVietnameseText(text);
  return (Object.entries(FIELD_PATTERNS) as [SkillField, readonly RegExp[]][])
    .filter(([, patterns]) => matches(normalized, patterns))
    .map(([field]) => field);
};

export const classifyTextHeuristic = (
  text: string,
): HeuristicClassification => {
  const normalized = normalizeVietnameseText(text);
  const weakSpamSignals = PATTERNS.spamWeak.filter((pattern) =>
    pattern.test(normalized),
  ).length;
  if (matches(normalized, PATTERNS.spamStrong) || weakSpamSignals >= 2) {
    return "ad_or_spam";
  }

  const isCtv = /\b(?:tuyen|can) ctv\b/.test(normalized);
  const explicitlyNotFulltime =
    /\bkhong (?:tuyen|can) (?:nhan vien|full[ -]?time|inhouse)\b/.test(
      normalized,
    );
  if (matches(normalized, PATTERNS.fulltime) && !explicitlyNotFulltime) {
    return "fulltime_recruitment";
  }
  if (matches(normalized, PATTERNS.seekingWork)) return "seeking_work";
  if (
    matches(normalized, PATTERNS.hiring) ||
    (isCtv && matches(normalized, PATTERNS.ctvFreelance))
  ) {
    return "hiring_freelancer";
  }
  return "unknown";
};
