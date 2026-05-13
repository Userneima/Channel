import { escapeHtml } from "../../shared/lib/helpers.js";

const buildMenuRow = ({ action, label, suffix = "", avatar = "" }) => `
    <button class="channel-menu-dialog__row" data-channel-menu-action="${action}" type="button">
        <span class="channel-menu-dialog__row-label">${escapeHtml(label)}</span>
        <span class="channel-menu-dialog__row-tail">
            ${suffix ? `<span class="channel-menu-dialog__row-suffix">${escapeHtml(suffix)}</span>` : ""}
            ${avatar ? `<img alt="${escapeHtml(suffix || label)}" class="channel-menu-dialog__row-avatar" src="${avatar}" />` : ""}
            <span class="material-icons-outlined">chevron_right</span>
        </span>
    </button>
`;

export const channelMenuDialogTemplate = (vm) => `
    <div class="channel-menu-dialog ${vm.open ? "is-open" : ""}">
        <div class="channel-menu-dialog__backdrop" data-channel-menu-action="close"></div>
        <div class="channel-menu-dialog__panel" style="${vm.panelStyle}">
            <div class="channel-menu-dialog__header">
                <div class="channel-menu-dialog__logo-shell">
                    <img alt="${escapeHtml(vm.channelName)}" class="channel-menu-dialog__logo" src="${vm.logoUrl}" />
                </div>
                <div class="channel-menu-dialog__meta">
                    <h3>${escapeHtml(vm.channelName)}</h3>
                    <p>${escapeHtml(vm.channelSlug)}</p>
                </div>
            </div>
            <div class="channel-menu-dialog__stack">
                ${buildMenuRow({
        action: "open-identity",
        label: "本频道昵称和头像",
        suffix: vm.identityName,
        avatar: vm.identityAvatar
    })}
                ${vm.canManageAnonymous ? `
                    <button class="channel-menu-dialog__row" data-channel-menu-action="toggle-anonymous-reveal" type="button">
                        <span class="channel-menu-dialog__row-label">匿名管理视角</span>
                        <span class="channel-menu-dialog__row-tail">
                            <span class="channel-menu-dialog__toggle ${vm.adminRevealAnonymous ? "is-active" : ""}">
                                <span class="channel-menu-dialog__toggle-thumb"></span>
                            </span>
                        </span>
                    </button>
                ` : ""}
                ${vm.canManageChannel ? buildMenuRow({
        action: "channel-management",
        label: "编辑频道资料"
    }) : ""}
                ${vm.canViewRegisteredUsers ? buildMenuRow({
        action: "registered-users",
        label: "已注册用户"
    }) : ""}
                ${buildMenuRow({
        action: "notification-settings",
        label: "消息通知"
    })}
                <button class="channel-menu-dialog__row" data-channel-menu-action="toggle-theme-mode" type="button">
                    <span class="channel-menu-dialog__row-label">暗黑模式</span>
                    <span class="channel-menu-dialog__row-tail">
                        <span class="channel-menu-dialog__toggle ${vm.themeMode === "dark" ? "is-active" : ""}">
                            <span class="channel-menu-dialog__toggle-thumb"></span>
                        </span>
                    </span>
                </button>
            </div>
            <button class="channel-menu-dialog__danger" data-channel-menu-action="leave-channel" type="button">退出频道</button>
        </div>
    </div>
`;
