export const attachChannelMenuDialogEvents = ({ root, actions }) => {
    root.addEventListener("click", (event) => {
        const button = event.target.closest("[data-channel-menu-action]");
        if (!button) {
            return;
        }

        const action = button.dataset.channelMenuAction;
        if (action === "close") {
            actions.closeOverlay("channel-menu");
            return;
        }

        if (action === "open-identity") {
            actions.closeOverlay("channel-menu");
            actions.openOverlay("identity");
            return;
        }

        if (action === "toggle-anonymous-reveal") {
            actions.toggleAdminRevealAnonymous();
            return;
        }

        if (action === "channel-management") {
            actions.closeOverlay("channel-menu");
            actions.openOverlay("channel-settings");
            return;
        }

        if (action === "registered-users") {
            actions.closeOverlay("channel-menu");
            void actions.openOverlay("registered-users");
            return;
        }

        if (action === "notification-settings") {
            actions.showToast({
                tone: "info",
                message: "消息通知设置后面再接，这一版先恢复菜单结构。"
            });
            return;
        }

        if (action === "leave-channel") {
            actions.showToast({
                tone: "info",
                message: "退出频道动作先不做真实执行，避免误删当前演示权限。"
            });
        }
    });
};
