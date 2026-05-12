import { channelShellConfig } from "../../entities/channel/config.js";
import { runtimeConfig } from "../../shared/config/runtime-config.js";

export const selectSidebarNavVM = (state) => {
    const currentChannel = state.runtimeState.channel;
    const activeSlug = currentChannel?.slug;
    const isDemoMode = activeSlug === "demo";
    const isAuthenticated = state.authState.status === "authenticated" && Boolean(state.authState.user?.id);
    const showAuthenticatedState = isAuthenticated && !isDemoMode;
    const homeHref = "?";
    const resolveChannelHref = (slug) => {
        if (!slug) {
            return "#";
        }
        return slug === "demo" ? "?view=demo" : `?channel=${encodeURIComponent(slug)}`;
    };
    const baseChannels = channelShellConfig.channelItems.map((item) => ({
        ...item,
        active: item.name === currentChannel?.name,
        href: item.name === currentChannel?.name && activeSlug ? resolveChannelHref(activeSlug) : "#"
    }));

    if (currentChannel && !baseChannels.some((item) => item.name === currentChannel.name)) {
        baseChannels.unshift({
            name: currentChannel.name,
            badge: (currentChannel.name || "频").slice(0, 1),
            avatar: currentChannel.logoUrl || channelShellConfig.channelLogo,
            active: true,
            href: resolveChannelHref(currentChannel.slug)
        });
    }

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
        channelItems: baseChannels,
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
        searchChannelName: currentChannel?.name || "频道",
        searchChannelBadge: (currentChannel?.name || "频").slice(0, 1),
        searchQuery: state.feedState.searchQuery || "",
        searchFocusNonce: state.uiState.searchFocusNonce || 0
    };
};
