export const attachMemberListDialogEvents = ({ root, actions }) => {
    root.addEventListener("click", (event) => {
        const button = event.target.closest("[data-member-list-action]");
        if (!button) {
            return;
        }

        const action = button.dataset.memberListAction;
        const identityId = button.dataset.memberListIdentityId || "";

        if (action === "close") {
            actions.closeOverlay("member-list");
            return;
        }

        if (!identityId && action !== "cancel-remove") {
            return;
        }

        if (action === "promote") {
            void actions.promoteMemberToAdmin(identityId);
            return;
        }

        if (action === "demote") {
            void actions.demoteAdminToMember(identityId);
            return;
        }

        if (action === "request-remove") {
            actions.requestRemoveMember(identityId);
            return;
        }

        if (action === "cancel-remove") {
            actions.cancelRemoveMember();
            return;
        }

        if (action === "confirm-remove") {
            void actions.confirmRemoveMember(identityId);
        }
    });
};
