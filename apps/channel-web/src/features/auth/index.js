import { getChannelActionErrorMessage } from "../../shared/lib/helpers.js";
import { getAppRoute } from "../../shared/lib/route.js";

export const createAuthActions = ({ store, dataService, showToast, runtimeActions }) => ({
    openAuthGate(mode = "login") {
        store.dispatch({
            type: "auth-gate/open",
            payload: { mode }
        });
    },
    closeAuthGate() {
        store.dispatch({ type: "auth-gate/close" });
    },
    setAuthField(partial) {
        store.dispatch({
            type: "auth/set-field",
            payload: partial
        });
    },
    async submitAuthFlow() {
        const mode = store.getState().overlayState.authGate.mode;
        if (mode === "register") {
            await this.registerWithPassword();
            return;
        }
        await this.loginWithPassword();
    },
    async loginWithPassword(
        email = store.getState().authState.email.trim(),
        password = store.getState().authState.password
    ) {
        if (!email || !password) {
            store.dispatch({
                type: "auth/set-field",
                payload: {
                    error: "请输入邮箱和密码。"
                }
            });
            return;
        }

        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "verifying",
                error: null
            }
        });

        try {
            await dataService.loginWithPassword(email, password);
            const route = getAppRoute();
            if (route.view === "create-channel") {
                const auth = await dataService.getAuthState();
                store.dispatch({
                    type: "auth/set-state",
                    payload: {
                        status: auth.user ? "authenticated" : "guest",
                        user: auth.user,
                        isAnonymous: false,
                        error: null,
                        password: ""
                    }
                });
                store.dispatch({ type: "auth-gate/close" });
            } else {
                await runtimeActions.refreshChannelAccessState();
            }
            store.dispatch({ type: "auth/reset-flow" });
            showToast({
                tone: "success",
                message: "登录成功。"
            });
        } catch (error) {
            const message = getChannelActionErrorMessage("login_with_password", error);
            store.dispatch({
                type: "auth/set-state",
                payload: {
                    status: "guest",
                    error: message
                }
            });
            store.dispatch({
                type: "membership/set-state",
                payload: {
                    status: "guest",
                    joinRequest: null,
                    reviewItems: [],
                    directoryItems: [],
                    directoryStatus: "idle",
                    directoryError: null,
                    mutationStatus: "idle",
                    activeMemberId: null,
                    reviewStatus: "idle",
                    submitStatus: "idle",
                    error: null
                }
            });
            showToast({
                tone: "error",
                message
            });
        }
    },
    async registerWithPassword(
        email = store.getState().authState.email.trim(),
        password = store.getState().authState.password,
        displayName = store.getState().authState.displayName.trim()
    ) {
        if (!displayName || !email || !password) {
            store.dispatch({
                type: "auth/set-field",
                payload: {
                    error: "请输入昵称、邮箱和密码。"
                }
            });
            return;
        }

        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "verifying",
                error: null
            }
        });

        try {
            await dataService.registerWithPassword(email, password, displayName);
            const route = getAppRoute();
            if (route.view === "create-channel") {
                const auth = await dataService.getAuthState();
                store.dispatch({
                    type: "auth/set-state",
                    payload: {
                        status: auth.user ? "authenticated" : "guest",
                        user: auth.user,
                        isAnonymous: false,
                        error: null,
                        password: "",
                        displayName: ""
                    }
                });
                store.dispatch({ type: "auth-gate/close" });
            } else {
                await runtimeActions.refreshChannelAccessState();
            }
            store.dispatch({ type: "auth/reset-flow" });
            showToast({
                tone: "success",
                message: "注册成功。"
            });
        } catch (error) {
            const message = getChannelActionErrorMessage("register_with_password", error);
            store.dispatch({
                type: "auth/set-state",
                payload: {
                    status: "guest",
                    error: message
                }
            });
            store.dispatch({
                type: "membership/set-state",
                payload: {
                    status: "guest",
                    joinRequest: null,
                    reviewItems: [],
                    directoryItems: [],
                    directoryStatus: "idle",
                    directoryError: null,
                    mutationStatus: "idle",
                    activeMemberId: null,
                    reviewStatus: "idle",
                    submitStatus: "idle",
                    error: null
                }
            });
            showToast({
                tone: "error",
                message
            });
        }
    },
    async logout() {
        try {
            await dataService.signOut();
            await runtimeActions.refreshChannelAccessState({
                reloadFeed: true
            });
            store.dispatch({ type: "auth/reset-flow" });
            showToast({
                tone: "success",
                message: "已退出登录。"
            });
        } catch (error) {
            const message = getChannelActionErrorMessage("logout", error);
            store.dispatch({
                type: "auth/set-state",
                payload: {
                    error: message
                }
            });
            showToast({
                tone: "error",
                message
            });
        }
    }
});
