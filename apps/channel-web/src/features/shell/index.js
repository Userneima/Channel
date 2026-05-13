import { applyDocumentTheme, normalizeThemeMode, writeStoredThemeMode } from "../../shared/lib/theme.js";

export const createShellActions = ({ store, dataService, showToast }) => ({
    initializeThemeMode(mode = "light") {
        const themeMode = applyDocumentTheme(mode);
        store.dispatch({
            type: "ui/set-theme-mode",
            payload: { value: themeMode }
        });
    },
    toggleThemeMode() {
        const current = normalizeThemeMode(store.getState().uiState.themeMode);
        const nextValue = current === "dark" ? "light" : "dark";
        applyDocumentTheme(nextValue);
        writeStoredThemeMode(nextValue);
        store.dispatch({
            type: "ui/set-theme-mode",
            payload: { value: nextValue }
        });
    },
    setSidebarOpen(open) {
        store.dispatch({
            type: "ui/set-sidebar",
            payload: { open }
        });
    },
    toggleSidebar() {
        const current = store.getState().uiState.sidebarOpen;
        this.setSidebarOpen(!current);
    },
    syncTopRegion(scrollY = window.scrollY) {
        const nextValue = scrollY > 48 ? "condensed" : "expanded";
        if (store.getState().uiState.topRegion === nextValue) {
            return;
        }
        store.dispatch({
            type: "ui/set-top-region",
            payload: { value: nextValue }
        });
    },
    setAccountMenuOpen(open) {
        store.dispatch({
            type: "ui/set-account-menu",
            payload: { open }
        });
    },
    toggleAccountMenu() {
        const current = store.getState().uiState.accountMenuOpen;
        this.setAccountMenuOpen(!current);
    },
    async openSearchDialog() {
        store.dispatch({ type: "search-dialog/open" });
        store.dispatch({ type: "search-dialog/load-start" });

        try {
            const items = await dataService.listPosts(null);
            store.dispatch({
                type: "search-dialog/load-success",
                payload: { items }
            });
        } catch (error) {
            store.dispatch({
                type: "search-dialog/load-error",
                payload: { error }
            });
            showToast?.({
                tone: "error",
                message: "频道搜索暂时不可用，请稍后再试。"
            });
        }
    },
    closeSearchDialog() {
        store.dispatch({ type: "search-dialog/close" });
    },
    setSearchDialogField(partial) {
        store.dispatch({
            type: "search-dialog/set-field",
            payload: partial
        });
    },
    requestSearchFocus() {
        void this.openSearchDialog();
    },
    openChannelMenu(anchor = {}) {
        store.dispatch({ type: "notification-center/close" });
        store.dispatch({
            type: "channel-menu/open",
            payload: anchor
        });
    },
    closeChannelMenu() {
        store.dispatch({ type: "channel-menu/close" });
    },
    toggleAdminRevealAnonymous() {
        store.dispatch({ type: "ui/toggle-admin-reveal-anonymous" });
    },
    openNotificationCenter(tab = "interaction", anchor = {}) {
        store.dispatch({ type: "channel-menu/close" });
        store.dispatch({
            type: "notification-center/open",
            payload: { tab, ...anchor }
        });
    },
    closeNotificationCenter() {
        store.dispatch({ type: "notification-center/close" });
    },
    setNotificationCenterTab(tab) {
        store.dispatch({
            type: "notification-center/set-tab",
            payload: { tab }
        });
    }
});
