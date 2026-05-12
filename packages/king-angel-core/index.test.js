const core = require("./index.cjs");

describe("king angel core", () => {
    it("keeps the fixed first-version stage order", () => {
        expect(core.STAGE_ORDER).toEqual(["wish", "claim", "delivery", "guess", "reveal"]);
        expect(core.getNextStage("delivery")).toBe("guess");
        expect(core.getNextStage("reveal")).toBeNull();
    });

    it("allows only owner and admin to manage the game", () => {
        expect(core.canManageGame("owner")).toBe(true);
        expect(core.canManageGame("admin")).toBe(true);
        expect(core.canManageGame("member")).toBe(false);
        expect(core.canManageGame("guest")).toBe(false);
    });

    it("blocks delivery until a wish has been claimed", () => {
        expect(core.canSubmitForStage("delivery", { claimSelected: false })).toBe(false);
        expect(core.getBlockedReason("delivery", { claimSelected: false })).toBe("需要先认领一个愿望。");
        expect(core.canSubmitForStage("delivery", { claimSelected: true, deliverySubmitted: false })).toBe(true);
    });

    it("normalizes API errors into the public contract", () => {
        expect(core.normalizeError("坏请求")).toEqual({
            code: "invalid_payload",
            message: "坏请求"
        });
        expect(core.normalizeError({ code: "forbidden", message: "不能操作" })).toMatchObject({
            code: "forbidden",
            message: "不能操作"
        });
    });
});
