import { getChannelActionErrorMessage } from "../../shared/lib/helpers.js";
import { runtimeConfig } from "../../shared/config/runtime-config.js";

const getChannelSlug = () => new URLSearchParams(window.location.search).get("channel")
    || runtimeConfig.channelSlug
    || "";

const getGuestMembershipState = () => ({
    status: "guest",
    joinRequest: null,
    reviewItems: [],
    reviewStatus: "idle",
    directoryItems: [],
    directoryStatus: "idle",
    directoryError: null,
    mutationStatus: "idle",
    activeMemberId: null,
    submitStatus: "idle",
    error: null
});

const normalizeMembershipState = (membership) => {
    if (membership?.status === "approved") {
        return membership;
    }

    return getGuestMembershipState();
};

const getPreferredBoard = (channel, fallbackBoard = "all") => (
    channel?.currentRoundStage
    || channel?.current_round_stage
    || fallbackBoard
);

const canLoadFeedForBootstrap = (bootstrap) => {
    const auth = bootstrap?.auth || { user: null, isAnonymous: false };
    return Boolean(auth.user) && !auth.isAnonymous;
};

const clearFeedPreview = (store) => {
    store.dispatch({
        type: "feed/load-success",
        payload: { items: [] }
    });
};

const applyBootstrapSnapshot = ({ store, bootstrap, source = "network", phase = "ready" }) => {
    const auth = bootstrap.auth || { user: null, isAnonymous: false };
    const isGuest = !auth.user || auth.isAnonymous;

    if (isGuest) {
        store.dispatch({
            type: "auth/set-state",
            payload: {
                status: "guest",
                user: null,
                isAnonymous: false,
                profileName: "",
                profileAvatar: "",
                error: null,
                password: ""
            }
        });
        store.dispatch({
            type: "membership/set-state",
            payload: getGuestMembershipState()
        });
        store.dispatch({
            type: "runtime/preview-ready",
            payload: {
                channel: bootstrap.channel,
                source,
                phase
            }
        });
        clearFeedPreview(store);
        return;
    }

    store.dispatch({
        type: "auth/set-state",
        payload: {
            status: "authenticated",
            user: auth.user,
            isAnonymous: false,
            profileName: String(auth.profile?.display_name || auth.profile?.displayName || "").trim(),
            profileAvatar: String(auth.profile?.avatar_url || auth.profile?.avatarUrl || "").trim(),
            error: null
        }
    });

    const membership = normalizeMembershipState(bootstrap.membership);
    const currentMembershipState = store.getState().membershipState;
    store.dispatch({
        type: "membership/set-state",
        payload: {
            status: membership.status,
            joinRequest: membership.joinRequest,
            reviewItems: membership.reviewItems || [],
            directoryItems: currentMembershipState.directoryItems || [],
            directoryStatus: currentMembershipState.directoryStatus || "idle",
            directoryError: currentMembershipState.directoryError || null,
            mutationStatus: currentMembershipState.mutationStatus || "idle",
            activeMemberId: currentMembershipState.activeMemberId || null,
            reviewStatus: "idle",
            submitStatus: "idle",
            error: null
        }
    });

    if (membership.status === "approved" && bootstrap.memberRuntime) {
        store.dispatch({
            type: "runtime/member-ready",
            payload: {
                ...bootstrap.memberRuntime,
                source,
                phase
            }
        });
        return;
    }

    store.dispatch({
        type: "runtime/preview-ready",
        payload: {
            channel: bootstrap.channel,
            source,
            phase
        }
    });
};

export const createRuntimeActions = ({ store, dataService, showToast, feedActions }) => ({
    async loadPublicChannelPreview(slug = getChannelSlug()) {
        const channel = await dataService.loadPublicChannelPreview(slug);
        store.dispatch({
            type: "runtime/preview-ready",
            payload: { channel }
        });
        return channel;
    },
    async loadMembershipState(channelId = store.getState().runtimeState.channel?.id) {
        if (!channelId) {
            return {
                status: "guest",
                joinRequest: null,
                reviewItems: [],
                role: null,
                directoryItems: []
            };
        }

        const membership = normalizeMembershipState(await dataService.loadMembershipState(channelId));
        const currentMembershipState = store.getState().membershipState;
        store.dispatch({
            type: "membership/set-state",
            payload: {
                status: membership.status,
                joinRequest: membership.joinRequest,
                reviewItems: membership.reviewItems || [],
                directoryItems: currentMembershipState.directoryItems || [],
                directoryStatus: currentMembershipState.directoryStatus || "idle",
                directoryError: currentMembershipState.directoryError || null,
                mutationStatus: currentMembershipState.mutationStatus || "idle",
                activeMemberId: currentMembershipState.activeMemberId || null,
                reviewStatus: "idle",
                submitStatus: "idle",
                error: null
            }
        });
        return membership;
    },
    async loadApprovedMemberRuntime(channelId = store.getState().runtimeState.channel?.id) {
        if (!channelId) {
            throw new Error("频道还没有初始化完成。");
        }

        const runtime = await dataService.loadApprovedMemberRuntime(channelId);
        store.dispatch({
            type: "runtime/member-ready",
            payload: runtime
        });
        return runtime;
    },
    async refreshChannelAccessState({ reloadFeed = false, channel = null } = {}) {
        const slug = channel?.slug || store.getState().runtimeState.channel?.slug || getChannelSlug();
        const bootstrap = await dataService.loadChannelBootstrap(slug);
        applyBootstrapSnapshot({
            store,
            bootstrap,
            source: "network",
            phase: "ready"
        });
        store.dispatch({ type: "auth-gate/close" });

        if (reloadFeed && canLoadFeedForBootstrap(bootstrap)) {
            await feedActions.loadFeed(store.getState().feedState.activeBoard);
        }
    },
    async initializeChannelRuntime() {
        const slug = getChannelSlug();
        const shellChannel = dataService.getChannelShell(slug);
        store.dispatch({
            type: "runtime/shell-ready",
            payload: {
                channel: shellChannel,
                source: shellChannel?.id ? "cache" : "runtime-config"
            }
        });
        store.dispatch({ type: "runtime/hydrate-start" });

        try {
            const cachedBootstrap = await dataService.getCachedChannelBootstrap(slug);
            let feedPromise = null;
            const fallbackBoard = store.getState().feedState.activeBoard;

            if (cachedBootstrap) {
                applyBootstrapSnapshot({
                    store,
                    bootstrap: cachedBootstrap,
                    source: "cache",
                    phase: "hydrating"
                });
                if (cachedBootstrap.channel?.id && canLoadFeedForBootstrap(cachedBootstrap)) {
                    feedPromise = feedActions.loadFeed(getPreferredBoard(cachedBootstrap.channel, fallbackBoard));
                }
            }

            const bootstrap = await dataService.loadChannelBootstrap(slug);
            applyBootstrapSnapshot({
                store,
                bootstrap,
                source: "network",
                phase: "ready"
            });

            const shouldLoadFeed = Boolean(bootstrap.channel?.id) && canLoadFeedForBootstrap(bootstrap);

            if (feedPromise && shouldLoadFeed) {
                await feedPromise;
            } else if (feedPromise) {
                await feedPromise.catch(() => null);
                clearFeedPreview(store);
            } else if (shouldLoadFeed) {
                await feedActions.loadFeed(getPreferredBoard(bootstrap.channel, fallbackBoard));
            }

            store.dispatch({ type: "auth-gate/close" });
        } catch (error) {
            const message = getChannelActionErrorMessage("init_runtime", error);
            store.dispatch({
                type: "runtime/initialize-error",
                payload: { error: message }
            });
            showToast({
                tone: "error",
                message
            });
        }
    }
});
