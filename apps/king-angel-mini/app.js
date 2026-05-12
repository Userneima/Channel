const { createStore } = require("./stores/app-store");
const api = require("./services/api");
const session = require("./services/session");

App({
    store: createStore(),
    globalData: {
        booted: false
    },

    onLaunch(options) {
        this.globalData.booted = true;
        this.store.setState({
            launchInviteCode: options?.query?.invite || "",
            session: session.getSession()
        });
    },

    async ensureLogin() {
        const existingSession = session.getSession();
        if (existingSession?.token && (!existingSession.expiresAt || existingSession.expiresAt > Date.now())) {
            this.store.setState({ session: existingSession });
            return existingSession;
        }
        if (existingSession?.token) {
            session.clearSession();
        }

        const loginResult = await new Promise((resolve, reject) => {
            wx.login({
                success: resolve,
                fail: reject
            });
        });

        const nextSession = await api.request("mini_login", {
            code: loginResult.code
        }, { skipAuth: true });

        session.setSession(nextSession);
        this.store.setState({ session: nextSession, currentUser: nextSession.user });
        return nextSession;
    }
});
