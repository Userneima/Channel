import { describe, expect, it, vi } from "vitest";
import { createStore } from "../shared/state/store.js";
import { mountChannelHeroBlock } from "../blocks/channel-hero/index.js";
import { selectChannelHeroVM } from "../blocks/channel-hero/selectors.js";

describe("channel hero member entry", () => {
    it("opens member list when clicking the member count", () => {
        const root = document.createElement("div");
        document.body.append(root);

        const store = createStore();
        store.dispatch({
            type: "runtime/preview-ready",
            payload: {
                channel: {
                    id: "channel-1",
                    slug: "channel",
                    name: "品运一家人",
                    logoUrl: "logo"
                }
            }
        });

        const actions = {
            requestSearchFocus: vi.fn(),
            openOverlay: vi.fn()
        };

        const block = mountChannelHeroBlock({ root, store, actions });
        block.render();

        const memberButton = root.querySelector("[data-channel-hero-action='members']");
        expect(memberButton).toBeTruthy();

        memberButton.click();

        expect(actions.openOverlay).toHaveBeenCalledWith("member-list");

        root.remove();
    });

    it("uses synced member statuses for the member count", () => {
        const store = createStore();
        store.dispatch({
            type: "membership/set-state",
            payload: {
                status: "approved",
                joinRequest: null,
                reviewItems: []
            }
        });
        store.dispatch({
            type: "runtime/member-ready",
            payload: {
                channel: {
                    id: "channel-1",
                    slug: "channel",
                    name: "品运一家人",
                    logoUrl: "logo"
                },
                realIdentity: { id: "identity-1", name: "章鱼烧", avatar: "avatar", meta: "当前真实身份", role: "owner" },
                anonymousProfiles: [{ id: "alias-1", key: "slot-baiyu", name: "白榆", avatar: "alias" }],
                activeAliasKey: "slot-baiyu"
            }
        });
        store.dispatch({
            type: "round/set-member-statuses",
            payload: {
                items: [
                    { identityId: "identity-1", userId: "user-1", name: "章鱼烧", avatar: "avatar" },
                    { identityId: "identity-2", userId: "user-2", name: "测试账号", avatar: "test-avatar" }
                ]
            }
        });

        const vm = selectChannelHeroVM(store.getState());
        expect(vm.memberCountLabel).toBe("2 成员");
    });

    it("deduplicates repeated identities from the same user in the member count", () => {
        const store = createStore();
        store.dispatch({
            type: "membership/set-state",
            payload: {
                status: "approved",
                joinRequest: null,
                reviewItems: [],
                directoryItems: [
                    { identityId: "identity-owner", userId: "user-1", name: "Yuchao", avatar: "owner-avatar", role: "owner" },
                    { identityId: "identity-member", userId: "user-1", name: "章鱼烧", avatar: "member-avatar", role: "member" }
                ]
            }
        });

        const vm = selectChannelHeroVM(store.getState());
        expect(vm.memberCountLabel).toBe("1 成员");
    });
});
