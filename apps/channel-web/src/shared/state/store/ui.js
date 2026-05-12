export const applyUiActions = (draft, action) => {
    switch (action.type) {
    case "ui/set-sidebar":
        draft.uiState.sidebarOpen = action.payload.open;
        return true;
    case "ui/set-top-region":
        draft.uiState.topRegion = action.payload.value;
        return true;
    case "ui/set-account-menu":
        draft.uiState.accountMenuOpen = action.payload.open;
        return true;
    case "ui/request-search-focus":
        draft.uiState.searchFocusNonce += 1;
        return true;
    case "ui/toggle-admin-reveal-anonymous":
        draft.uiState.adminRevealAnonymous = !draft.uiState.adminRevealAnonymous;
        return true;
    default:
        return false;
    }
};
