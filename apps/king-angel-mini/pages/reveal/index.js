const api = require("../../services/api");

Page({
    data: {
        gameId: "",
        pairs: [],
        stage: "",
        error: ""
    },

    async onLoad(options) {
        this.setData({ gameId: options.gameId || "" });
        await this.loadReveal();
    },

    async loadReveal() {
        try {
            const data = await api.request("get_game_state", { gameId: this.data.gameId });
            this.setData({
                pairs: data.revealPairs || [],
                stage: data.game.currentStage
            });
        } catch (error) {
            this.setData({ error: error.message || "揭晓加载失败。" });
        }
    }
});
