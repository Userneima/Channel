const api = require("../../services/api");

Page({
    data: {
        gameId: "",
        members: [],
        loading: false,
        error: ""
    },

    async onLoad(options) {
        this.setData({ gameId: options.gameId || "" });
        await this.loadMembers();
    },

    async loadMembers() {
        this.setData({ loading: true, error: "" });
        try {
            const data = await api.request("get_game_state", { gameId: this.data.gameId });
            this.setData({ members: data.members || [] });
        } catch (error) {
            this.setData({ error: error.message || "成员加载失败。" });
        } finally {
            this.setData({ loading: false });
        }
    }
});
