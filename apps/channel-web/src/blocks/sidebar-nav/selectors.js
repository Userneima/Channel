import { channelShellConfig } from "../../entities/channel/config.js";
import { runtimeConfig } from "../../shared/config/runtime-config.js";
import { buildRoundDisplayTitle } from "../../features/round/model.js";

export const selectSidebarNavVM = (state) => {
    const currentChannel = state.runtimeState.channel;
    const activeSlug = currentChannel?.slug;
    const isDemoMode = activeSlug === "demo";
    const isAuthenticated = state.authState.status === "authenticated" && Boolean(state.authState.user?.id);
    const showAuthenticatedState = isAuthenticated && !isDemoMode;
    const homeHref = "?";
    const currentRoundTitle = buildRoundDisplayTitle({
        title: state.roundState.defaultTitle,
        theme: state.roundState.theme,
        startedAt: state.roundState.startedAt
    });
    const archiveViewerRoundId = state.roundState.archiveViewerRoundId || null;
    const roundItems = [];

    if (currentChannel) {
        roundItems.push({
            id: state.roundState.currentRoundId || "current-round",
            name: currentRoundTitle,
            meta: "当前进行中",
            badge: "今",
            avatar: currentChannel.logoUrl || channelShellConfig.channelLogo,
            active: !archiveViewerRoundId,
            kind: "current"
        });
    }

    (state.roundState.archives || []).forEach((archive) => {
        roundItems.push({
            id: archive.id,
            name: buildRoundDisplayTitle({
                title: archive.title,
                theme: archive.theme,
                completedAt: archive.completedAt,
                createdAt: archive.createdAt
            }),
            meta: "已归档",
            badge: "档",
            avatar: currentChannel?.logoUrl || channelShellConfig.channelLogo,
            active: archiveViewerRoundId === archive.id,
            kind: "archive"
        });
    });

    return {
        brandName: channelShellConfig.brandName,
        brandHref: homeHref,
        navItems: channelShellConfig.primaryNavItems.map((item, index) => ({
            ...item,
            href: index === 0 ? homeHref : "#"
        })),
        demoPromo: isDemoMode
            ? {
                eyebrow: "准备正式参与？",
                title: "登录进入真实频道参与本周回合",
                description: "真实频道会使用正式账号和真实数据。",
                primaryLabel: "进入真实频道",
                primaryHref: runtimeConfig.channelSlug ? `?channel=${encodeURIComponent(runtimeConfig.channelSlug)}` : "?",
                note: ""
            }
            : null,
        unjoinedItems: [],
        roundItems,
        sidebarOpen: state.uiState.sidebarOpen,
        accountMenuOpen: state.uiState.accountMenuOpen,
        isDemoMode,
        demoHref: runtimeConfig.channelSlug ? `?channel=${encodeURIComponent(runtimeConfig.channelSlug)}` : "?view=directory",
        currentIdentity: showAuthenticatedState
            ? state.runtimeState.realIdentity
            : {
                name: isDemoMode ? "试玩模式" : "未登录",
                avatar: currentChannel?.logoUrl || channelShellConfig.channelLogo
            },
        currentUserEmail: showAuthenticatedState
            ? (state.authState.user?.email || "")
            : isDemoMode
                ? "本地演示，不写入真实频道"
                : "公开浏览模式",
        canLogout: showAuthenticatedState,
        isAuthenticated: showAuthenticatedState,
        searchChannelName: currentRoundTitle,
        searchChannelBadge: (currentChannel?.name || "频").slice(0, 1),
        searchQuery: state.feedState.searchQuery || "",
        searchFocusNonce: state.uiState.searchFocusNonce || 0
    };
};
