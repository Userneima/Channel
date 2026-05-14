import { describe, expect, it, vi, afterEach } from "vitest";
import {
    formatAbsoluteDateLabel,
    formatActivityTimeLabel,
    looksLikeAnsweredPromptInsteadOfRewrite
} from "../shared/lib/helpers.js";

describe("time formatting helpers", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("switches old activity timestamps to absolute dates", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-05-13T12:00:00.000Z"));

        expect(formatActivityTimeLabel("2026-05-13T10:00:00.000Z")).toBe("2小时前");
        expect(formatActivityTimeLabel("2026-05-11T10:00:00.000Z")).toBe("2026.05.11");
    });

    it("formats absolute dates with dots", () => {
        expect(formatAbsoluteDateLabel("2026-04-20T08:30:00.000Z")).toBe("2026.04.20");
    });

    it("flags expanded answer-like rewrite output", () => {
        expect(looksLikeAnsweredPromptInsteadOfRewrite(
            "请天使推荐一些解压小游戏",
            [
                "可以试试这些轻松上手的小游戏，节奏舒缓、操作简单，适合碎片时间放松：",
                "- 《开罗游戏》系列",
                "- 《纪念碑谷》",
                "- 《动物森友会》"
            ].join("\n")
        )).toBe(true);
    });

    it("keeps short paraphrases as valid rewrites", () => {
        expect(looksLikeAnsweredPromptInsteadOfRewrite(
            "请天使推荐一些解压小游戏",
            "想请天使推荐几款适合放松心情的解压小游戏。"
        )).toBe(false);
    });
});
