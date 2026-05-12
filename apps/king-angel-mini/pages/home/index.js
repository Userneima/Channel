const api = require("../../services/api");

Page({
    data: {
        loading: false,
        games: [],
        inviteCode: "",
        newGameName: "",
        error: ""
    },

    async onLoad(options) {
        if (options?.invite) {
            this.setData({ inviteCode: options.invite });
        }
        await this.loadGames();
    },

    async loadGames() {
        const app = getApp();
        this.setData({ loading: true, error: "" });
        try {
            await app.ensureLogin();
            const data = await api.request("get_my_games");
            this.setData({ games: data.games || [] });
        } catch (error) {
            this.setData({ error: error.message || "加载失败。" });
        } finally {
            this.setData({ loading: false });
        }
    },

    onGameNameInput(event) {
        this.setData({ newGameName: event.detail.value });
    },

    onInviteInput(event) {
        this.setData({ inviteCode: event.detail.value });
    },

    async createGame() {
        const name = this.data.newGameName.trim();
        if (!name) {
            this.setData({ error: "先给这局游戏起个名字。" });
            return;
        }

        this.setData({ loading: true, error: "" });
        try {
            const data = await api.request("create_game", { name });
            wx.navigateTo({ url: `/pages/game/index?gameId=${data.game.id}` });
        } catch (error) {
            this.setData({ error: error.message || "创建失败。" });
        } finally {
            this.setData({ loading: false });
        }
    },

    async joinGame() {
        const inviteCode = this.data.inviteCode.trim();
        if (!inviteCode) {
            this.setData({ error: "请输入邀请口令。" });
            return;
        }

        this.setData({ loading: true, error: "" });
        try {
            const data = await api.request("join_game", { inviteCode });
            wx.navigateTo({ url: `/pages/game/index?gameId=${data.game.id}` });
        } catch (error) {
            this.setData({ error: error.message || "加入失败。" });
        } finally {
            this.setData({ loading: false });
        }
    },

    openGame(event) {
        wx.navigateTo({ url: `/pages/game/index?gameId=${event.currentTarget.dataset.id}` });
    }
});
