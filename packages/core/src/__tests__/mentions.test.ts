import { describe, expect, it } from "vitest";
import { docMentionIds, encodeMentions, mentionToken, parseMentions, splitMentions, stripMentions } from "../mentions";

const SAM = { memberId: "11111111-1111-4111-8111-111111111111", name: "Sam" };
const SAM_LEE = { memberId: "22222222-2222-4222-8222-222222222222", name: "Sam Lee" };

describe("encodeMentions", () => {
  it("encodes picked names and leaves hand-typed ones alone", () => {
    expect(encodeMentions("hey @Sam and @Nobody", [SAM])).toBe(`hey ${mentionToken(SAM)} and @Nobody`);
  });

  it("prefers the longest name so a first-name pick can't claim a full name", () => {
    const body = encodeMentions("@Sam Lee meet @Sam", [SAM, SAM_LEE]);
    expect(parseMentions(body)).toEqual([SAM_LEE, SAM]);
  });

  it("does not match a name that runs into more letters", () => {
    expect(encodeMentions("@Samantha", [SAM])).toBe("@Samantha");
  });

  it("drops a pick whose text was deleted", () => {
    expect(encodeMentions("never mind", [SAM])).toBe("never mind");
  });
});

describe("splitMentions / parseMentions / stripMentions", () => {
  const body = `Can ${mentionToken(SAM_LEE)} check this? cc ${mentionToken(SAM)} ${mentionToken(SAM)}`;

  it("splits into ordered text and mention runs", () => {
    const segs = splitMentions(body);
    expect(segs[0]).toEqual({ type: "text", text: "Can " });
    expect(segs[1]).toEqual({ type: "mention", ...SAM_LEE });
    expect(segs.filter((s) => s.type === "mention")).toHaveLength(3);
  });

  it("lists each person once", () => {
    expect(parseMentions(body)).toEqual([SAM_LEE, SAM]);
  });

  it("reads back as plain @names", () => {
    expect(stripMentions(body)).toBe("Can @Sam Lee check this? cc @Sam @Sam");
  });

  it("treats a body with no tokens as one text run", () => {
    expect(splitMentions("plain")).toEqual([{ type: "text", text: "plain" }]);
  });
});

describe("docMentionIds", () => {
  it("finds nested mention nodes once each", () => {
    const doc = { type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "hi " }, { type: "mention", attrs: { id: SAM.memberId, label: "Sam" } }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "mention", attrs: { id: SAM.memberId } }, { type: "mention", attrs: { id: SAM_LEE.memberId } }] }] }] },
    ] };
    expect(docMentionIds(doc)).toEqual([SAM.memberId, SAM_LEE.memberId]);
    expect(docMentionIds(null)).toEqual([]);
  });
});
