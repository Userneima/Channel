import { getChannelActionErrorMessage } from "../../shared/lib/helpers.js";
import { navigateToChannel, navigateToCreateChannel, queueFlashToast } from "../../shared/lib/route.js";

export const createChannelCreateActions = ({ store, dataService, showToast }) => ({
    openCreateChannelPage() {
        navigateToCreateChannel();
    },
    setCreateChannelField(partial) {
        store.dispatch({
            type: "channel-create/set-field",
            payload: partial
        });
    },
    async initializeCreateChannelPage() {
        try {
            const auth = await dataService.getAuthState();
            if (!auth.user || auth.isAnonymous) {
                store.dispatch({
                    type: "auth/set-state",
                    payload: {
                        status: "guest",
                        user: null,
                        isAnonymous: false,
                        error: null
                    }
                });
                store.dispatch({
                    type: "auth-gate/open",
                    payload: { mode: "login" }
                });
                return;
            }

            store.dispatch({
                type: "auth/set-state",
                payload: {
                    status: "authenticated",
                    user: auth.user,
                    isAnonymous: false,
                    error: null
                }
            });
            store.dispatch({ type: "auth-gate/close" });
        } catch (error) {
            const message = getChannelActionErrorMessage("init_create_channel", error);
            store.dispatch({
                type: "auth/set-state",
                payload: {
                    status: "guest",
                    user: null,
                    isAnonymous: false,
                    error: null
                }
            });
            showToast({
                tone: "error",
                message
            });
        }
    },
    async submitCreateChannel(
        name = store.getState().channelCreateState.name.trim(),
        description = store.getState().channelCreateState.description.trim()
    ) {
        if (!name) {
            store.dispatch({
                type: "channel-create/set-field",
                payload: {
                    error: "请输入频道名称。"
                }
            });
            return;
        }

        const authState = store.getState().authState;
        if (authState.status !== "authenticated") {
            store.dispatch({
                type: "auth-gate/open",
                payload: { mode: "login" }
            });
            return;
        }

        store.dispatch({ type: "channel-create/submit-start" });

        try {
            const runtime = await dataService.createChannel({ name, description });
            store.dispatch({ type: "channel-create/reset" });
            store.dispatch({
                type: "runtime/member-ready",
                payload: runtime
            });
            store.dispatch({
                type: "membership/set-state",
                payload: {
                    status: "approved",
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

            queueFlashToast({
                tone: "success",
                message: "频道已创建。"
            });
            navigateToChannel(runtime.channel.slug);
        } catch (error) {
            const message = getChannelActionErrorMessage("create_channel", error);
            store.dispatch({
                type: "channel-create/submit-error",
                payload: { error: message }
            });
            showToast({
                tone: "error",
                message
            });
        }
    }
});
