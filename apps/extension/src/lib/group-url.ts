import {
  FacebookGroupUrlSchema,
  GroupRefSchema,
  type GroupRef,
} from "@flr/shared";

export const extractGroupId = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "www.facebook.com") {
      return null;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "groups" || parts[1] === undefined) return null;
    return /^[A-Za-z0-9._-]{1,128}$/.test(parts[1]) ? parts[1] : null;
  } catch {
    return null;
  }
};

export const normalizeGroupUrl = (value: string): string | null => {
  const groupId = extractGroupId(value.trim());
  if (groupId === null) return null;
  const normalized = `https://www.facebook.com/groups/${groupId}`;
  return FacebookGroupUrlSchema.safeParse(normalized).success
    ? normalized
    : null;
};

export const createGroupRef = (name: string, url: string): GroupRef => {
  const normalizedUrl = normalizeGroupUrl(url);
  const groupId = normalizedUrl === null ? null : extractGroupId(normalizedUrl);
  return GroupRefSchema.parse({
    groupId,
    name,
    url: normalizedUrl,
    active: true,
  });
};
