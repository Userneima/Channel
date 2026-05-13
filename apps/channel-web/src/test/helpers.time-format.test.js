import { describe, expect, it, vi, afterEach } from "vitest";
import { formatAbsoluteDateLabel, formatActivityTimeLabel } from "../shared/lib/helpers.js";

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
});
