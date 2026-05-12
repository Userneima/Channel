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

    it("deduplicates legacy duplicate identities for the same user in manage mode", () => {
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
                    { identityId: "identity-owner", userId: "user-1", name: "Yuchao", avatar: "owner-avatar", role: "owner", createdAt: "2026-05-10T10:00:00.000Z" },
                    { identityId: "identity-member", userId: "user-1", name: "章鱼烧", avatar: "member-avatar", role: "member", createdAt: "2026-05-11T10:00:00.000Z" },
                    { identityId: "identity-2", userId: "user-2", name: "测试账号", avatar: "test-avatar", role: "member", createdAt: "2026-05-11T11:00:00.000Z" }
                ]
            }
        });
        store.dispatch({
            type: "runtime/member-ready",
            payload: {
                channel: { id: "channel-1", slug: "channel", name: "频道" },
                realIdentity: { id: "identity-owner", name: "Yuchao", avatar: "owner-avatar", meta: "当前真实身份", role: "owner" },
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

        const items = [...root.querySelectorAll(".member-list-dialog__item")];
        expect(items).toHaveLength(2);
        expect(root.textContent).toContain("Yuchao");
        expect(root.textContent).not.toContain("章鱼烧成员");
        expect(root.textContent).toContain("2 位当前社区成员");

        root.remove();
    });

    it("falls back to the directory role when runtime role is stale", () => {
        const root = document.createElement("div");
        document.body.append(root);

        const store = createStore();
        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "authenticated",
                user: { id: "user-1", email: "owner@example.com" },
                isAnonymous: false
            }
        });
        store.dispatch({
            type: "membership/set-state",
            payload: {
                status: "approved",
                joinRequest: null,
                reviewItems: [],
                directoryItems: [
                    { identityId: "identity-owner", userId: "user-1", name: "Yuchao", avatar: "owner-avatar", role: "owner", createdAt: "2026-05-10T10:00:00.000Z" },
                    { identityId: "identity-member", userId: "user-1", name: "章鱼烧", avatar: "member-avatar", role: "member", createdAt: "2026-05-11T10:00:00.000Z" },
                    { identityId: "identity-2", userId: "user-2", name: "测试账号", avatar: "test-avatar", role: "member", createdAt: "2026-05-11T11:00:00.000Z" }
                ]
            }
        });
        store.dispatch({
            type: "runtime/member-ready",
            payload: {
                channel: { id: "channel-1", slug: "channel", name: "频道" },
                realIdentity: { id: "identity-member", name: "章鱼烧", avatar: "member-avatar", meta: "当前真实身份", role: "member" },
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

        expect(root.textContent).toContain("移除成员");
        expect(root.textContent).toContain("创建者");

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
