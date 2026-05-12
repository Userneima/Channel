const api = require("../../services/api");
const { getStage } = require("../../services/game-rules");

Page({
    data: {
        gameId: "",
        game: null,
        stage: null,
        body: "",
        targetId: "",
        wishes: [],
        members: [],
        loading: false,
        error: ""
    },

    async onLoad(options) {
        this.setData({ gameId: options.gameId || "" });
        await this.loadGame();
    },

    async loadGame() {
        this.setData({ loading: true, error: "" });
        try {
            const data = await api.request("get_game_state", { gameId: this.data.gameId });
            this.setData({
                game: data,
                stage: getStage(data.game.currentStage),
                wishes: data.posts?.filter((post) => post.board === "wish") || [],
                members: data.members || []
            });
        } catch (error) {
            this.setData({ error: error.message || "加载失败。" });
        } finally {
            this.setData({ loading: false });
        }
    },

    onBodyInput(event) {
        this.setData({ body: event.detail.value });
    },

    onTargetChange(event) {
        const index = Number(event.detail.value);
        const stage = this.data.stage?.value;
        this.setData({
            targetId: stage === "claim"
                ? this.data.wishes[index]?.id || ""
                : String(index)
        });
    },

    async submit() {
        const stage = this.data.stage?.value;
        const body = this.data.body.trim();
        const targetId = this.data.targetId;
        const payload = { gameId: this.data.gameId, body, targetId };
        const actionByStage = {
            wish: "submit_wish",
            claim: "claim_wish",
            delivery: "submit_delivery",
            guess: "submit_guess"
        };
        const action = actionByStage[stage];
        if (!action) {
            this.setData({ error: "当前阶段不需要提交。" });
            return;
        }

        this.setData({ loading: true, error: "" });
        try {
            await api.request(action, payload);
            wx.showToast({ title: "已提交", icon: "success" });
            wx.navigateBack();
        } catch (error) {
            this.setData({ error: error.message || "提交失败。" });
        } finally {
            this.setData({ loading: false });
        }
    }
});
