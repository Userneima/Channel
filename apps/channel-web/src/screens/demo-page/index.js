import "./styles.css";
import { demoPageTemplate } from "./template.js";
import { mountSidebarNavBlock } from "../../blocks/sidebar-nav/index.js";
import { mountChannelHeroBlock } from "../../blocks/channel-hero/index.js";
import { mountBoardTabsBlock } from "../../blocks/board-tabs/index.js";
import { mountComposerPanelBlock } from "../../blocks/composer-panel/index.js";
import { mountFeedListBlock } from "../../blocks/feed-list/index.js";
import { mountCommentDrawerBlock } from "../../blocks/comment-drawer/index.js";
import { mountImageLightboxBlock } from "../../blocks/image-lightbox/index.js";
import { mountChannelIntelligenceBlock } from "../../blocks/channel-intelligence/index.js";
import { mountNotificationCenterBlock } from "../../blocks/notification-center/index.js";
import { mountMemberListDialogBlock } from "../../blocks/member-list-dialog/index.js";
import { mountChannelMenuDialogBlock } from "../../blocks/channel-menu-dialog/index.js";
import { mountChannelSettingsDialogBlock } from "../../blocks/channel-settings-dialog/index.js";
import { mountIdentityDialogBlock } from "../../blocks/identity-dialog/index.js";
import { mountAuthGateBlock } from "../../blocks/auth-gate/index.js";
import { mountSearchDialogBlock } from "../../blocks/search-dialog/index.js";
import { mountRegisteredUsersDialogBlock } from "../../blocks/registered-users-dialog/index.js";
import { mountSystemFeedbackBlock } from "../../blocks/system-feedback/index.js";

export const mountDemoPage = ({ root, store, actions }) => {
    root.innerHTML = demoPageTemplate();

    const blockSlots = {
        sidebarNav: root.querySelector('[data-screen-slot="sidebar-nav"]'),
        channelHero: root.querySelector('[data-screen-slot="channel-hero"]'),
        boardTabs: root.querySelector('[data-screen-slot="board-tabs"]'),
        channelIntelligence: root.querySelector('[data-screen-slot="channel-intelligence"]'),
        composerPanel: root.querySelector('[data-screen-slot="composer-panel"]'),
        feedList: root.querySelector('[data-screen-slot="feed-list"]'),
        commentDrawer: root.querySelector('[data-screen-slot="comment-drawer"]'),
        imageLightbox: root.querySelector('[data-screen-slot="image-lightbox"]'),
        notificationCenter: root.querySelector('[data-screen-slot="notification-center"]'),
        memberListDialog: root.querySelector('[data-screen-slot="member-list-dialog"]'),
        channelMenuDialog: root.querySelector('[data-screen-slot="channel-menu-dialog"]'),
        channelSettingsDialog: root.querySelector('[data-screen-slot="channel-settings-dialog"]'),
        channelIntelligenceDialog: root.querySelector('[data-screen-slot="channel-intelligence-dialog"]'),
        identityDialog: root.querySelector('[data-screen-slot="identity-dialog"]'),
        authGate: root.querySelector('[data-screen-slot="auth-gate"]'),
        searchDialog: root.querySelector('[data-screen-slot="search-dialog"]'),
        registeredUsersDialog: root.querySelector('[data-screen-slot="registered-users-dialog"]'),
        systemFeedback: root.querySelector('[data-screen-slot="system-feedback"]')
    };

    const screenRoot = root.querySelector("[data-screen-root]");

    const blocks = [
        mountSidebarNavBlock({ root: blockSlots.sidebarNav, store, actions }),
        mountChannelHeroBlock({ root: blockSlots.channelHero, store, actions }),
        mountBoardTabsBlock({ root: blockSlots.boardTabs, store, actions }),
        mountChannelIntelligenceBlock({
            root: blockSlots.channelIntelligence,
            dialogRoot: blockSlots.channelIntelligenceDialog,
            store,
            actions
        }),
        mountComposerPanelBlock({ root: blockSlots.composerPanel, store, actions }),
        mountFeedListBlock({ root: blockSlots.feedList, store, actions }),
        mountCommentDrawerBlock({ root: blockSlots.commentDrawer, store, actions }),
        mountImageLightboxBlock({ root: blockSlots.imageLightbox, store, actions }),
        mountNotificationCenterBlock({ root: blockSlots.notificationCenter, store, actions }),
        mountMemberListDialogBlock({ root: blockSlots.memberListDialog, store, actions }),
        mountChannelMenuDialogBlock({ root: blockSlots.channelMenuDialog, store, actions }),
        mountChannelSettingsDialogBlock({ root: blockSlots.channelSettingsDialog, store, actions }),
        mountIdentityDialogBlock({ root: blockSlots.identityDialog, store, actions }),
        mountAuthGateBlock({ root: blockSlots.authGate, store, actions }),
        mountSearchDialogBlock({ root: blockSlots.searchDialog, store, actions }),
        mountRegisteredUsersDialogBlock({ root: blockSlots.registeredUsersDialog, store, actions }),
        mountSystemFeedbackBlock({ root: blockSlots.systemFeedback, store, actions })
    ];

    let resizeTimeout = null;

    const renderAll = () => {
        const state = store.getState();
        screenRoot?.classList.toggle("channel-page--condensed", state.uiState.topRegion === "condensed");
        blocks.forEach((block) => {
            block.render();
        });
    };

    const syncViewportState = () => {
        actions.syncTopRegion(window.scrollY);
        if (window.innerWidth > 1080) {
            actions.setSidebarOpen(false);
        }
    };

    window.addEventListener("scroll", () => {
        actions.syncTopRegion(window.scrollY);
    }, { passive: true });

    window.addEventListener("resize", () => {
        window.clearTimeout(resizeTimeout);
        resizeTimeout = window.setTimeout(syncViewportState, 60);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") {
            return;
        }
        actions.closeOverlay("comments");
        actions.closeOverlay("image-lightbox");
        actions.closeOverlay("notification-center");
        actions.closeOverlay("member-list");
        actions.closeOverlay("channel-intelligence");
        actions.closeOverlay("round-management");
        actions.closeOverlay("channel-menu");
        actions.closeOverlay("channel-settings");
        actions.closeOverlay("identity");
        actions.closeOverlay("auth-gate");
        actions.closeOverlay("search-dialog");
        actions.closeOverlay("registered-users");
        actions.cancelDeleteConfirm?.();
        actions.setSidebarOpen(false);
        actions.setAccountMenuOpen(false);
        actions.hideToast();
    });

    store.subscribe(() => {
        renderAll();
    });

    syncViewportState();
    renderAll();
};
