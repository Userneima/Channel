export const attachRegisteredUsersDialogEvents = ({ root, actions }) => {
    root.addEventListener("click", (event) => {
        const button = event.target.closest("[data-registered-users-action]");
        if (!button) {
            return;
        }

        if (button.dataset.registeredUsersAction === "close") {
            actions.closeOverlay("registered-users");
        }
    });
};
