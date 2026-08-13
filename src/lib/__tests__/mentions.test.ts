import { describe, expect, it } from "vitest";
import {
  activeMentionQuery,
  commentPreview,
  mentionedUserIds,
  parseComment,
  userMentionToken,
} from "../mentions";

const DANA = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

describe("parseComment", () => {
  it("handles plain text", () => {
    expect(parseComment("looks good")).toEqual([{ kind: "text", text: "looks good" }]);
  });

  it("parses user tokens with spaces in names", () => {
    const body = `hey ${userMentionToken("Dana Designer", DANA)} check this`;
    expect(parseComment(body)).toEqual([
      { kind: "text", text: "hey " },
      { kind: "user", userId: DANA, name: "Dana Designer" },
      { kind: "text", text: " check this" },
    ]);
  });

  it("parses version tags", () => {
    expect(parseComment("compare @v1 and @v12")).toEqual([
      { kind: "text", text: "compare " },
      { kind: "version", version: 1 },
      { kind: "text", text: " and " },
      { kind: "version", version: 12 },
    ]);
  });

  it("does not treat emails or mid-word @v as mentions", () => {
    expect(parseComment("mail me@vendor.com")).toEqual([
      { kind: "text", text: "mail me@vendor.com" },
    ]);
  });

  it("mixes user and version mentions", () => {
    const body = `${userMentionToken("Mack", DANA)} is @v2 ok?`;
    const kinds = parseComment(body).map((s) => s.kind);
    expect(kinds).toEqual(["user", "text", "version", "text"]);
  });
});

describe("mentionedUserIds", () => {
  it("dedupes repeated mentions", () => {
    const t = userMentionToken("Dana", DANA);
    expect(mentionedUserIds(`${t} and again ${t}`)).toEqual([DANA]);
  });
});

describe("commentPreview", () => {
  it("flattens tokens to readable text", () => {
    const body = `ping ${userMentionToken("Dana Designer", DANA)} about @v3`;
    expect(commentPreview(body)).toBe("ping @Dana Designer about @v3");
  });
});

describe("activeMentionQuery", () => {
  it("finds the query being typed", () => {
    expect(activeMentionQuery("hello @da", 9)).toEqual({ query: "da", start: 6 });
  });

  it("matches a bare @ at the caret", () => {
    expect(activeMentionQuery("@", 1)).toEqual({ query: "", start: 0 });
  });

  it("requires @ to start a word", () => {
    expect(activeMentionQuery("me@ven", 6)).toBeNull();
  });

  it("stops after whitespace", () => {
    expect(activeMentionQuery("@dana thanks", 12)).toBeNull();
  });
});
