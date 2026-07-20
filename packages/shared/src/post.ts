import { z } from "zod";
import {
  FacebookPostUrlSchema,
  FacebookUrlSchema,
  GroupIdSchema,
  IsoDateTimeSchema,
  PostKeySchema,
} from "./primitives";

const RawPostBaseSchema = z
  .object({
    postKey: PostKeySchema,
    groupId: GroupIdSchema,
    permalink: FacebookPostUrlSchema,
    authorName: z.string().trim().min(1).max(200).optional(),
    authorProfileUrl: FacebookUrlSchema.optional(),
    anonymousPoster: z.boolean().default(false),
    text: z.string().max(50_000),
    truncated: z.boolean().default(false),
    postedAtText: z.string().trim().min(1).max(100).optional(),
    seenAt: IsoDateTimeSchema,
  })
  .strict();

const requireMatchingPostKey = (
  post: { postKey: string; groupId: string },
  context: z.RefinementCtx,
) => {
  if (!post.postKey.startsWith(`${post.groupId}:`)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["postKey"],
      message: "postKey phải bắt đầu bằng groupId của bài viết",
    });
  }
};

export const RawPostSchema = RawPostBaseSchema.superRefine(
  requireMatchingPostKey,
);
export type RawPost = z.infer<typeof RawPostSchema>;

export const PostInputSchema = z
  .object({
    postKey: PostKeySchema,
    text: z.string().max(50_000),
    anonymousPoster: z.boolean().default(false),
    truncated: z.boolean().default(false),
    postedAtText: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
export type PostInput = z.infer<typeof PostInputSchema>;
