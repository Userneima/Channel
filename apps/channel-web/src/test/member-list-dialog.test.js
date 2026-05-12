import { describe, expect, it } from "vitest";
import { createStore } from "../shared/state/store.js";
import { mountMemberListDialogBlock } from "../blocks/member-list-dialog/index.js";

const createDialogActions = () => ({
    closeOverlay() {},
    promoteMemberToAdmin() {},
    demoteAdminToMember() {},
    requestRemoveMember() {},
    cancelRemoveMember() {},
    confirmRemoveMember() {}
});

describe("member list dialog", () => {
    it("renders the current community roster when open", () => {
        const root = document.createElement("div");
        document.body.append(root);

        const store = createStore();
        store.dispatch({ type: "member-list/open" });

        const block = mountMemberListDialogBlock({ root, store, actions: createDialogActions() });
        block.render();

        expect(root.textContent).toContain("频道成员");
        expect(root.textContent).toContain("雯子");
        expect(root.textContent).toContain("咪咪");
        expect(root.textContent).toContain("Trytry");
        expect(root.querySelector(".member-list-dialog")?.getAttribute("aria-hidden")).toBe("false");

        root.remove();
    });

    it("renders owner-facing management actions from the synced directory", () => {
        const root = document.createElement("div");
        document.body.append(root);

        const store = createStore();
        store.dispatch({
            type: "membership/set-state",
            payload: {
                status: "approved",
                joinRequest: null,
                reviewItems: [],
                directoryItems: [
                    { identityId: "identity-1", userId: "user-1", name: "章鱼烧", avatar: "avatar", role: "owner" },
                    { identityId: "identity-2", userId: "user-2", name: "测试账号", avatar: "test-avatar", role: "member" },
                    { identityId: "identity-3", userId: "user-3", name: "值班管理员", avatar: "admin-avatar", role: "admin" }
                ]
            }
        });
        store.dispatch({
            type: "runtime/member-ready",
            payload: {
                channel: { id: "channel-1", slug: "channel", name: "频道" },
                realIdentity: { id: "identity-1", name: "章鱼烧", avatar: "avatar", meta: "当前真实身份", role: "owner" },
                anonymousProfiles: [{ id: "alias-1", key: "slot-baiyu", name: "白榆", avatar: "alias" }],
                activeAliasKey: "slot-baiyu"
            }
        });
        store.dispatch({
            type: "member-list/open",
            payload: { mode: "manage" }
        });

        const block = mountMemberListDialogBlock({ root, store, actions: createDialogActions() });
        block.render();

        expect(root.textContent).toContain("测试账号");
        expect(root.textContent).toContain("创建者");
        expect(root.textContent).toContain("管理员");
        expect(root.textContent).toContain("设为管理员");
        expect(root.textContent).toContain("取消管理员");
        expect(root.textContent).toContain("移除成员");

        root.remove();
    });

    it("hides owner-only role actions for admin viewers", () => {
        const root = document.createElement("div");
        document.body.append(root);

        const store = createStore();
        store.dispatch({
            type: "membership/set-state",
            payload: {
                status: "approved",
                joinRequest: null,
                reviewItems: [],
                directoryItems: [
                    { identityId: "identity-1", userId: "user-1", name: "章鱼烧", avatar: "avatar", role: "admin" },
                    { identityId: "identity-2", userId: "user-2", name: "测试账号", avatar: "test-avatar", role: "member" },
                    { identityId: "identity-3", userId: "user-3", name: "创建者", avatar: "owner-avatar", role: "owner" }
                ]
            }
        });
        store.dispatch({
            type: "runtime/member-ready",
            payload: {
                channel: { id: "channel-1", slug: "channel", name: "频道" },
                realIdentity: { id: "identity-1", name: "章鱼烧", avatar: "avatar", meta: "当前真实身份", role: "admin" },
                anonymousProfiles: [{ id: "alias-1", key: "slot-baiyu", name: "白榆", avatar: "alias" }],
                activeAliasKey: "slot-baiyu"
            }
        });
        store.dispatch({
            type: "member-list/open",
            payload: { mode: "manage" }
        });

        const block = mountMemberListDialogBlock({ root, store, actions: createDialogActions() });
        block.render();

        expect(root.textContent).not.toContain("设为管理员");
        expect(root.textContent).not.toContain("取消管理员");
        expect(root.textContent).toContain("移除成员");

        root.remove();
    });

    it("marks the dialog hidden when closed", () => {
        const root = document.createElement("div");
        document.body.append(root);

        const store = createStore();
        const block = mountMemberListDialogBlock({ root, store, actions: createDialogActions() });
        block.render();

        const dialog = root.querySelector(".member-list-dialog");
        expect(dialog?.classList.contains("is-open")).toBe(false);
        expect(dialog?.getAttribute("aria-hidden")).toBe("true");

        root.remove();
    });
});
