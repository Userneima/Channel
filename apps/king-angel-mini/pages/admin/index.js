const api = require("../../services/api");
const { getNextStage } = require("../../services/game-rules");

Page({
    data: {
        gameId: "",
        game: null,
        theme: "",
        error: "",
        loading: false
    },

    async onLoad(options) {
        this.setData({ gameId: options.gameId || "" });
        await this.loadGame();
    },

    async loadGame() {
        try {
            const data = await api.request("get_game_state", { gameId: this.data.gameId });
            this.setData({ game: data, theme: data.game.theme || "" });
        } catch (error) {
            this.setData({ error: error.message || "加载失败。" });
        }
    },

    onThemeInput(event) {
        this.setData({ theme: event.detail.value });
    },

    async advanceStage() {
        const nextStage = getNextStage(this.data.game?.game?.currentStage);
        if (!nextStage) {
            this.setData({ error: "已经是最后一个阶段。" });
            return;
        }

        this.setData({ loading: true, error: "" });
        try {
            await api.request("advance_stage", {
                gameId: this.data.gameId,
                nextStage,
                theme: this.data.theme
            });
            await this.loadGame();
        } catch (error) {
            this.setData({ error: error.message || "推进失败。" });
        } finally {
            this.setData({ loading: false });
        }
    },

    async generateReveal() {
        this.setData({ loading: true, error: "" });
        try {
            await api.request("generate_reveal", { gameId: this.data.gameId });
            await this.loadGame();
            wx.showToast({ title: "已生成", icon: "success" });
        } catch (error) {
            this.setData({ error: error.message || "生成失败。" });
        } finally {
            this.setData({ loading: false });
        }
    },

    async confirmReveal() {
        this.setData({ loading: true, error: "" });
        try {
            await api.request("confirm_reveal", { gameId: this.data.gameId });
            wx.navigateTo({ url: `/pages/reveal/index?gameId=${this.data.gameId}` });
        } catch (error) {
            this.setData({ error: error.message || "确认失败。" });
        } finally {
            this.setData({ loading: false });
        }
    }
});
