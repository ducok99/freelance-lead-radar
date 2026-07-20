import { z } from "zod";
import { MAX_AUDIT_EVENTS, SCHEMA_VERSION } from "./constants";
import { AuditActionSchema } from "./enums";
import {
  IsoDateTimeSchema,
  PostKeySchema,
  SchemaVersionSchema,
  UlidSchema,
} from "./primitives";

const FORBIDDEN_AUDIT_KEYS = new Set([
  "password",
  "passwd",
  "cookie",
  "cookies",
  "session",
  "sessionid",
  "sessiontoken",
  "token",
  "teamtoken",
  "accesstoken",
  "refreshtoken",
  "facebooktoken",
  "apikey",
  "authorization",
  "credential",
  "credentials",
  "secret",
  "privatekey",
  "phone",
  "email",
  "zalo",
  "contact",
  "contacts",
  "authorname",
  "authorprofileurl",
  "posttext",
  "finalcomment",
]);

const SECRET_VALUE_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{8,}/i,
  /Bearer\s+\S+/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(?:^|;\s*)(?:c_user|xs|fr)=/i,
];

const PII_VALUE_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:\+?84|0)(?:3|5|7|8|9)(?:[\s.-]*\d){8}\b/,
];

const FORBIDDEN_STRUCTURE_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

const normalizeKey = (key: string) =>
  key.toLowerCase().replace(/[^a-z0-9]/g, "");

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
};

const validateAuditValue = (
  value: unknown,
  path: readonly (string | number)[],
  context: z.RefinementCtx,
  ancestors: WeakSet<object>,
): void => {
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return;
  }

  if (typeof value === "string") {
    if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path],
        message: "Audit detail không được chứa secret, cookie hoặc credential",
      });
    }
    if (PII_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path],
        message: "Audit detail không được chứa email hoặc số điện thoại",
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path],
        message: "Audit detail không được chứa tham chiếu vòng",
      });
      return;
    }
    ancestors.add(value);
    value.forEach((item, index) =>
      validateAuditValue(item, [...path, index], context, ancestors),
    );
    ancestors.delete(value);
    return;
  }

  if (typeof value === "object" && value !== null) {
    if (!isPlainRecord(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path],
        message: "Audit detail chỉ được chứa object JSON thuần",
      });
      return;
    }
    if (ancestors.has(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path],
        message: "Audit detail không được chứa tham chiếu vòng",
      });
      return;
    }
    ancestors.add(value);
    for (const [key, descriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(value),
    )) {
      if (
        FORBIDDEN_AUDIT_KEYS.has(normalizeKey(key)) ||
        FORBIDDEN_STRUCTURE_KEYS.has(key.toLowerCase())
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, key],
          message: `Audit detail không được chứa trường nhạy cảm: ${key}`,
        });
      }
      if (descriptor.get !== undefined || descriptor.set !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, key],
          message: "Audit detail không được chứa getter hoặc setter",
        });
        continue;
      }
      validateAuditValue(descriptor.value, [...path, key], context, ancestors);
    }
    ancestors.delete(value);
    return;
  }

  context.addIssue({
    code: z.ZodIssueCode.custom,
    path: [...path],
    message: "Audit detail chỉ được chứa dữ liệu JSON",
  });
};

export const AuditDetailSchema = z
  .custom<Record<string, unknown>>(isPlainRecord, {
    message: "Audit detail phải là object JSON thuần",
  })
  .superRefine((detail, context) =>
    validateAuditValue(detail, [], context, new WeakSet()),
  );
export type AuditDetail = z.infer<typeof AuditDetailSchema>;

export const AuditEventSchema = z
  .object({
    id: UlidSchema,
    ts: IsoDateTimeSchema,
    actor: z.enum(["user", "system"]),
    action: AuditActionSchema,
    leadId: UlidSchema.optional(),
    postKey: PostKeySchema.optional(),
    detail: AuditDetailSchema.default({}),
    schemaVersion: SchemaVersionSchema.default(SCHEMA_VERSION),
  })
  .strict();
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const AuditLogSchema = z.array(AuditEventSchema).max(MAX_AUDIT_EVENTS);
export type AuditLog = z.infer<typeof AuditLogSchema>;
