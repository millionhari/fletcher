import { describe, expect, it } from "vitest";
import { checkUploadAllowed, fmtBytes, isVideoFile, quotaBytesFor } from "../storage/quota";

const GiB = 1024 ** 3;

describe("quotaBytesFor", () => {
  it("maps plans to bytes and honours a custom size", () => {
    expect(quotaBytesFor("free", null)).toBe(2 * GiB);
    expect(quotaBytesFor("paid", null)).toBe(100 * GiB);
    expect(quotaBytesFor("custom", 500)).toBe(500 * GiB);
    expect(quotaBytesFor("custom", null)).toBe(2 * GiB);
  });
});

describe("isVideoFile", () => {
  it("uses mime first, then extension for browsers that send none", () => {
    expect(isVideoFile("video/mp4", "x.bin")).toBe(true);
    expect(isVideoFile("", "cut.MOV")).toBe(true);
    expect(isVideoFile("image/png", "art.png")).toBe(false);
  });
});

describe("checkUploadAllowed", () => {
  it("blocks video on free but allows it on paid", () => {
    const base = { usedBytes: 0, quotaBytes: 2 * GiB, incomingBytes: 100, mimeType: "video/mp4", fileName: "cut.mp4" };
    expect(checkUploadAllowed({ ...base, plan: "free" })).toMatchObject({ ok: false, reason: "video_not_on_free" });
    expect(checkUploadAllowed({ ...base, plan: "paid" })).toEqual({ ok: true });
  });
  it("blocks when the file would exceed the quota", () => {
    const r = checkUploadAllowed({ plan: "free", usedBytes: 1.5 * GiB, quotaBytes: 2 * GiB, incomingBytes: 0.6 * GiB, mimeType: "image/png", fileName: "a.png" });
    expect(r).toMatchObject({ ok: false, reason: "over_quota" });
    expect((r as { message: string }).message).toContain("1.5 GB of 2.0 GB");
  });
});

describe("fmtBytes", () => {
  it("scales units", () => {
    expect(fmtBytes(512)).toBe("1 KB");
    expect(fmtBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(fmtBytes(250 * 1024 * 1024)).toBe("250 MB");
    expect(fmtBytes(12.4 * GiB)).toBe("12 GB");
  });
});
