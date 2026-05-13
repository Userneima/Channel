export const attachSidebarNavEvents = ({ root, actions }) => {
    root.addEventListener("click", (event) => {
        const button = event.target.closest("[data-sidebar-action]");
        if (!button) {
            return;
        }

        event.stopPropagation();

        const action = button.dataset.sidebarAction;
        if (action === "toggle") {
            actions.toggleSidebar();
            return;
        }

        if (action === "close") {
            actions.setSidebarOpen(false);
            return;
        }

        if (action === "identity") {
            actions.setAccountMenuOpen(false);
            actions.openOverlay("identity");
            return;
        }

        if (action === "search") {
            actions.requestSearchFocus();
            return;
        }

        if (action === "toggle-account-menu") {
            actions.toggleAccountMenu();
            return;
        }

        if (action === "login") {
            actions.openAuthGate("login");
            return;
        }

        if (action === "logout") {
            actions.setAccountMenuOpen(false);
            void actions.logout();
        }
    });

    root.addEventListener("click", (event) => {
        const roundButton = event.target.closest("[data-sidebar-round-id]");
        if (!roundButton) {
            return;
        }

        const roundKind = roundButton.dataset.sidebarRoundKind || "current";
        const roundId = roundButton.dataset.sidebarRoundId || "";
        actions.setSidebarOpen(false);

        if (roundKind === "archive") {
            void actions.viewSelectedArchiveInBoard(roundId);
            return;
        }

        void actions.exitArchiveViewer();
    });
};
