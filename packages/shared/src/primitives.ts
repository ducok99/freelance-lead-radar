import { z } from "zod";
import { SCHEMA_VERSION } from "./constants";

const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const POST_KEY_PATTERN = /^[A-Za-z0-9._-]{1,128}:[A-Za-z0-9._-]{1,256}$/;
const GROUP_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const UlidSchema = z
  .string()
  .regex(ULID_PATTERN, "ID phải là ULID viết hoa hợp lệ");

export const GroupIdSchema = z
  .string()
  .trim()
  .regex(GROUP_ID_PATTERN, "groupId không hợp lệ");

export const PostKeySchema = z
  .string()
  .trim()
  .regex(POST_KEY_PATTERN, "postKey phải có dạng groupId:postId");

export const IsoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: "Thời gian phải là ISO 8601 có múi giờ" });

export const DateOnlySchema = z
  .string()
  .regex(DATE_ONLY_PATTERN, "Ngày phải có dạng YYYY-MM-DD")
  .refine((value) => {
    const [yearText, monthText, dayText] = value.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Ngày không tồn tại");

export const HttpsUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"), "URL phải dùng HTTPS");

export const FacebookUrlSchema = HttpsUrlSchema.refine(
  (value) => /^https:\/\/www\.facebook\.com(?:\/|$)/i.test(value),
  "URL phải thuộc www.facebook.com",
);

export const FacebookGroupUrlSchema = FacebookUrlSchema.refine(
  (value) =>
    /^https:\/\/www\.facebook\.com\/groups\/[^/?#]+\/?(?:[?#].*)?$/i.test(
      value,
    ),
  "URL phải là URL nhóm Facebook",
);

export const FacebookPostUrlSchema = FacebookUrlSchema.refine(
  (value) =>
    /^https:\/\/www\.facebook\.com\/groups\/[^/?#]+\/(?:posts|permalink)\/[^/?#]+\/?(?:[?#].*)?$/i.test(
      value,
    ),
  "URL phải là permalink bài viết trong nhóm Facebook",
);

export const ApiBaseUrlSchema = z.union([
  z.literal(""),
  z
    .string()
    .url()
    .refine(
      (value) =>
        /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev(?::\d+)?(?:\/|$)/i.test(
          value,
        ) ||
        /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(value),
      "API URL phải thuộc workers.dev; HTTP chỉ được phép cho localhost",
    ),
]);

export const ScoreSchema = z.number().int().min(0).max(100);
export const ConfidenceSchema = z.number().min(0).max(1);
export const NonNegativeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

export const VndAmountSchema = NonNegativeIntegerSchema;

export const SchemaVersionSchema = z.literal(SCHEMA_VERSION);

export type Ulid = z.infer<typeof UlidSchema>;
export type PostKey = z.infer<typeof PostKeySchema>;
