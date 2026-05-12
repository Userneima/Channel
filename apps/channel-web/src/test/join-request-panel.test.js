import { describe, expect, it, vi } from "vitest";
import { mountJoinRequestPanelBlock } from "../blocks/join-request-panel/index.js";
import { createStore } from "../shared/state/store.js";

describe("join request panel input stability", () => {
    it("hides the panel once the user is an approved member", () => {
        const root = document.createElement("div");
        document.body.append(root);
        const store = createStore();
        const actions = {
            setMembershipField: vi.fn(),
            openAuthGate: vi.fn(),
            submitJoinRequest: vi.fn()
        };

        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "authenticated",
                user: { email: "member@example.com" }
            }
        });
        store.dispatch({
            type: "membership/set-state",
            payload: {
                status: "approved",
                joinRequest: null,
                reviewItems: []
            }
        });

        const block = mountJoinRequestPanelBlock({ root, store, actions });
        block.render();

        expect(root.innerHTML).toBe("");

        root.remove();
    });

    it("stays visible for guests even if stale membership state says approved", () => {
        const root = document.createElement("div");
        document.body.append(root);
        const store = createStore();
        const actions = {
            setMembershipField: vi.fn(),
            openAuthGate: vi.fn(),
            submitJoinRequest: vi.fn()
        };

        store.dispatch({
            type: "runtime/preview-ready",
            payload: {
                channel: { id: "channel-1", slug: "soulmap", name: "Soulmap" }
            }
        });
        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "guest",
                user: null,
                isAnonymous: false
            }
        });
        store.dispatch({
            type: "membership/set-state",
            payload: {
                status: "approved",
                joinRequest: null,
                reviewItems: []
            }
        });

        const block = mountJoinRequestPanelBlock({ root, store, actions });
        block.render();

        const loginButton = root.querySelector("[data-join-request-action='login']");
        expect(loginButton).toBeTruthy();
        expect(root.textContent).toContain("邮箱登录");
        expect(root.textContent).toContain("登录后即可参与");

        root.remove();
    });

    it("shows a submit action for authenticated viewers who are not yet approved", () => {
        const root = document.createElement("div");
        document.body.append(root);
        const store = createStore();
        const actions = {
            setMembershipField: vi.fn(),
            openAuthGate: vi.fn(),
            submitJoinRequest: vi.fn()
        };

        store.dispatch({
            type: "runtime/preview-ready",
            payload: {
                channel: { id: "channel-1", slug: "soulmap", name: "Soulmap" }
            }
        });
        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "authenticated",
                user: { id: "user-2", email: "member@example.com" },
                isAnonymous: false
            }
        });
        store.dispatch({
            type: "membership/set-state",
            payload: {
                status: "guest",
                joinRequest: null,
                reviewItems: []
            }
        });

        const block = mountJoinRequestPanelBlock({ root, store, actions });
        block.render();

        const submitButton = root.querySelector("[data-join-request-action='submit']");
        expect(submitButton).toBeTruthy();
        expect(root.textContent).toContain("申请加入当前频道");
        expect(root.textContent).toContain("申请加入");

        root.remove();
    });
});
