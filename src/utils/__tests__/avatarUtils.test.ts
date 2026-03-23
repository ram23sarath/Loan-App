import { describe, expect, it } from "vitest";
import {
  buildAvatarPath,
  buildMergedAvatarMetadata,
  extensionFromMimeType,
  getAvatarMetadata,
  validateAvatarUploadPath,
} from "../avatarUtils";

describe("avatarUtils", () => {
  it("builds deterministic path from uid + mime type", () => {
    expect(buildAvatarPath("abc-123", "image/webp")).toBe("users/abc-123/avatar.webp");
    expect(buildAvatarPath("abc-123", "image/jpeg")).toBe("users/abc-123/avatar.jpg");
    expect(buildAvatarPath("abc-123", "image/png")).toBe("users/abc-123/avatar.png");
  });

  it("validates avatar upload path restrictions", () => {
    const uid = "user-1";
    expect(validateAvatarUploadPath("users/user-1/avatar.webp", uid)).toBe(true);
    expect(validateAvatarUploadPath("/users/user-1/avatar.webp", uid)).toBe(false);
    expect(validateAvatarUploadPath("users/user-2/avatar.webp", uid)).toBe(false);
    expect(validateAvatarUploadPath("users/user-1/avatar.gif", uid)).toBe(false);
    expect(validateAvatarUploadPath("users/user-1/../avatar.webp", uid)).toBe(false);
  });

  it("extracts avatar metadata safely", () => {
    expect(getAvatarMetadata({ avatar_path: "users/u/avatar.webp", avatar_updated_at: "2026-01-01" })).toEqual({
      avatarPath: "users/u/avatar.webp",
      avatarUpdatedAt: "2026-01-01",
    });

    expect(getAvatarMetadata({ avatar_path: "", avatar_updated_at: 123 as unknown as string })).toEqual({
      avatarPath: null,
      avatarUpdatedAt: null,
    });
  });

  it("merges metadata without dropping existing keys", () => {
    const merged = buildMergedAvatarMetadata(
      { name: "Admin", is_admin: true },
      "users/u/avatar.webp",
      "2026-03-01T10:00:00.000Z",
    );

    expect(merged).toEqual({
      name: "Admin",
      is_admin: true,
      avatar_path: "users/u/avatar.webp",
      avatar_updated_at: "2026-03-01T10:00:00.000Z",
    });
  });

  it("normalizes extension from mime type", () => {
    expect(extensionFromMimeType("image/webp")).toBe("webp");
    expect(extensionFromMimeType("image/png")).toBe("png");
    expect(extensionFromMimeType("image/jpeg")).toBe("jpg");
    expect(extensionFromMimeType("image/jpg")).toBe("jpg");
  });
});
