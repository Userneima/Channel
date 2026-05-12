import { beforeEach, describe, expect, it } from "vitest";
import { createStore } from "../shared/state/store.js";
import { createAppActions } from "../features/app-actions.js";
import { createDemoDataService } from "../demo/data-service.js";
import { selectComposerPanelVM } from "../blocks/composer-panel/selectors.js";
import { mentionMembers } from "../entities/identity/config.js";

describe("demo mode", () => {
    let store;
    let dataService;
    let actions;

    beforeEach(() => {
        store = createStore();
        dataService = createDemoDataService();
        actions = createAppActions({
            store,
            dataService
        });
        store.dispatch({
            type: "feed/set-board",
            payload: { board: "wish" }
        });
        store.dispatch({
            type: "round/set-stage",
            payload: {
                stage: "wish",
                forceAnonymous: true
            }
        });
    });

    it("initializes as a local approved demo runtime", async () => {
        await actions.initializeChannelRuntime();

        const state = store.getState();
        expect(state.runtimeState.channel?.slug).toBe("demo");
        expect(state.authState.status).toBe("authenticated");
        expect(state.membershipState.status).toBe("approved");
        expect(state.feedState.activeBoard).toBe("wish");
        expect(state.feedState.items.every((item) => item.board === "wish")).toBe(true);
    });

    it("supports local wish, claim, delivery, guess and reveal without real login", async () => {
        await actions.initializeChannelRuntime();

        store.dispatch({
            type: "composer/set-field",
            payload: {
                draftText: "希望有人帮我做一个一周玄学入门地图"
            }
        });
        await actions.submitPost();

        expect(store.getState().feedState.items.some((item) => item.text.includes("一周玄学入门地图"))).toBe(true);

        await actions.setActiveBoard("claim");
        await actions.claimWish("wish-1");

        expect(store.getState().roundState.claimSelection?.postId).toBe("wish-1");

        await actions.setActiveBoard("delivery");
        store.dispatch({
            type: "composer/set-field",
            payload: {
                draftText: "我给你整理了一份最小可执行清单"
            }
        });
        await actions.submitPost();

        expect(store.getState().feedState.activeBoard).toBe("guess");
        expect(store.getState().roundState.activeStage).toBe("guess");

        actions.selectMentionTarget({
            name: "瓜子",
            avatar: mentionMembers.find((member) => member.name === "瓜子")?.avatar || ""
        });
        store.dispatch({
            type: "composer/set-field",
            payload: {
                draftText: "线索的表达方式很像瓜子"
            }
        });
        await actions.submitPost();

        expect(store.getState().roundState.guessSelection?.name).toBe("瓜子");

        await actions.setActiveBoard("reveal");
        const vm = selectComposerPanelVM(store.getState());
        expect(vm.revealResult?.actualName).toBe("瓜子");
        expect(vm.revealResult?.isCorrect).toBe(true);
    });
});
