const api = require("../../services/api");
const { buildMemberTask } = require("../../services/game-rules");

Page({
    data: {
        gameId: "",
        loading: true,
        game: null,
        task: null,
        error: ""
    },

    async onLoad(options) {
        this.setData({ gameId: options.gameId || "" });
        await this.loadGame();
    },

    async onShow() {
        if (this.data.gameId) {
            await this.loadGame();
        }
    },

    async loadGame() {
        if (!this.data.gameId) {
            this.setData({ loading: false, error: "缺少游戏 ID。" });
            return;
        }

        const app = getApp();
        this.setData({ loading: true, error: "" });
        try {
            await app.ensureLogin();
            const data = await api.request("get_game_state", { gameId: this.data.gameId });
            const task = buildMemberTask({
                stageValue: data.game.currentStage,
                memberStatus: data.me?.roundStatus || {},
                role: data.me?.role || "guest"
            });
            this.setData({ game: data, task });
        } catch (error) {
            this.setData({ error: error.message || "加载失败。" });
        } finally {
            this.setData({ loading: false });
        }
    },

    openTask() {
        wx.navigateTo({ url: `/pages/task/index?gameId=${this.data.gameId}` });
    },

    openMembers() {
        wx.navigateTo({ url: `/pages/members/index?gameId=${this.data.gameId}` });
    },

    openReveal() {
        wx.navigateTo({ url: `/pages/reveal/index?gameId=${this.data.gameId}` });
    },

    openAdmin() {
        wx.navigateTo({ url: `/pages/admin/index?gameId=${this.data.gameId}` });
    },

    onShareAppMessage() {
        const game = this.data.game?.game || {};
        return {
            title: `加入「${game.name || "国王与天使"}」`,
            path: `/pages/home/index?invite=${game.inviteCode || game.slug || game.id}`
        };
    }
});
