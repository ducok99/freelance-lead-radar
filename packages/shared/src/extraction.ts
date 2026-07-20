import { z } from "zod";
import {
  BudgetPeriodSchema,
  ContactChannelSchema,
  SkillFieldSchema,
} from "./enums";
import { DateOnlySchema, VndAmountSchema } from "./primitives";

const uniqueStrings = (values: readonly string[]) =>
  new Set(values.map((value) => value.toLocaleLowerCase("vi"))).size ===
  values.length;

export const BudgetSchema = z
  .object({
    raw: z.string().trim().min(1).max(200),
    minVnd: VndAmountSchema.optional(),
    maxVnd: VndAmountSchema.optional(),
    per: BudgetPeriodSchema.nullable().default(null),
  })
  .strict()
  .superRefine((budget, context) => {
    if (
      budget.minVnd !== undefined &&
      budget.maxVnd !== undefined &&
      budget.minVnd > budget.maxVnd
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxVnd"],
        message: "maxVnd phải lớn hơn hoặc bằng minVnd",
      });
    }
  });
export type Budget = z.infer<typeof BudgetSchema>;

export const DeadlineSchema = z
  .object({
    raw: z.string().trim().min(1).max(200),
    date: DateOnlySchema.optional(),
  })
  .strict();
export type Deadline = z.infer<typeof DeadlineSchema>;

export const PublicContactSchema = z
  .object({
    channel: ContactChannelSchema,
    value: z.string().trim().min(1).max(320),
  })
  .strict();
export type PublicContact = z.infer<typeof PublicContactSchema>;

export const ExtractionSchema = z
  .object({
    jobSummary: z.string().trim().min(1).max(1_000),
    field: SkillFieldSchema,
    budget: BudgetSchema.optional(),
    deadline: DeadlineSchema.optional(),
    tools: z
      .array(z.string().trim().min(1).max(100))
      .max(50)
      .refine(uniqueStrings, "Danh sách công cụ không được trùng")
      .default([]),
    contacts: z
      .array(PublicContactSchema)
      .max(20)
      .refine(
        (contacts) =>
          new Set(
            contacts.map(
              (contact) =>
                `${contact.channel}:${contact.value.toLocaleLowerCase("vi")}`,
            ),
          ).size === contacts.length,
        "Danh sách liên hệ không được trùng",
      )
      .default([]),
  })
  .strict();
export type Extraction = z.infer<typeof ExtractionSchema>;
