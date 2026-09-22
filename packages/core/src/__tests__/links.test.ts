import { describe, expect, it } from "vitest";
import { detectLinkProvider, hostAllowed, parseCloudLink } from "../links";

describe("detectLinkProvider", () => {
  it("names the common hosts", () => {
    expect(detectLinkProvider("https://docs.google.com/document/d/abc/edit")).toBe("google_docs");
    expect(detectLinkProvider("https://www.notion.so/team/Page-1")).toBe("notion");
    expect(detectLinkProvider("https://youtu.be/x")).toBe("youtube");
    expect(detectLinkProvider("https://example.com")).toBe(null);
    expect(detectLinkProvider("not a url")).toBe(null);
  });
});

describe("parseCloudLink", () => {
  it("extracts Drive file ids from both URL shapes", () => {
    expect(parseCloudLink("https://drive.google.com/file/d/1AbC_x-9/view?usp=sharing")).toMatchObject({ provider: "google_drive", id: "1AbC_x-9" });
    expect(parseCloudLink("https://drive.google.com/open?id=1AbC")).toMatchObject({ provider: "google_drive", id: "1AbC" });
    expect(parseCloudLink("https://drive.google.com/drive/folders/1AbC")).toBe(null);
  });
  it("turns Dropbox share links into direct downloads", () => {
    const p = parseCloudLink("https://www.dropbox.com/scl/fi/abc/cut.mp4?rlkey=xyz&dl=0");
    expect(p?.provider).toBe("dropbox");
    expect(new URL(p!.url).searchParams.get("dl")).toBe("1");
    expect(parseCloudLink("https://www.dropbox.com/sh/folder/xyz")).toBe(null);
  });
  it("reads Box file ids and passes share hashes through", () => {
    expect(parseCloudLink("https://app.box.com/file/123456")).toMatchObject({ provider: "box", id: "123456" });
    expect(parseCloudLink("https://app.box.com/s/abcdef")).toMatchObject({ provider: "box", id: null });
  });
});

describe("hostAllowed", () => {
  it("matches exact and wildcard hosts only", () => {
    expect(hostAllowed("dropbox", "uc123.dl.dropboxusercontent.com")).toBe(true);
    expect(hostAllowed("dropbox", "evil.com")).toBe(false);
    expect(hostAllowed("google_drive", "www.googleapis.com")).toBe(true);
    expect(hostAllowed("box", "dl.boxcloud.com")).toBe(true);
    expect(hostAllowed("box", "boxcloud.com.evil.com")).toBe(false);
  });
});
