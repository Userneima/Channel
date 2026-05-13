import { escapeHtml } from "../../shared/lib/helpers.js";

const buildBodyContent = (vm) => {
    if (vm.loading) {
        return '<div class="registered-users-dialog__status">正在拉取已注册用户列表...</div>';
    }

    if (vm.error) {
        return `<div class="registered-users-dialog__status registered-users-dialog__status--error">${escapeHtml(vm.error)}</div>`;
    }

    if (!vm.items.length) {
        return '<div class="registered-users-dialog__status">当前还没有可展示的注册用户。</div>';
    }

    return vm.items.map((item) => `
        <article class="registered-users-dialog__item">
            <div class="registered-users-dialog__row">
                <img alt="${escapeHtml(item.displayName)}" class="registered-users-dialog__avatar" src="${item.avatarUrl}" />
                <div class="registered-users-dialog__copy">
                    <div class="registered-users-dialog__name">${escapeHtml(item.displayName)}</div>
                    <div class="registered-users-dialog__email">${escapeHtml(item.email || "未记录邮箱")}</div>
                </div>
                <span class="registered-users-dialog__status-badge ${item.hasSignedIn ? "is-ready" : ""}">
                    ${item.hasSignedIn ? "已登录过" : "未登录过"}
                </span>
            </div>
            <div class="registered-users-dialog__meta-grid">
                <div class="registered-users-dialog__meta-block">
                    <span class="registered-users-dialog__meta-label">注册时间</span>
                    <span class="registered-users-dialog__meta-value">${escapeHtml(item.createdAtLabel)}</span>
                </div>
                <div class="registered-users-dialog__meta-block">
                    <span class="registered-users-dialog__meta-label">最近登录</span>
                    <span class="registered-users-dialog__meta-value">${escapeHtml(item.lastSignInAtLabel)}</span>
                </div>
            </div>
        </article>
    `).join("");
};

export const registeredUsersDialogTemplate = (vm) => `
    <div class="registered-users-dialog ${vm.open ? "is-open" : ""}" aria-hidden="${vm.open ? "false" : "true"}">
        <div class="registered-users-dialog__backdrop" data-registered-users-action="close"></div>
        <section class="registered-users-dialog__panel" role="dialog" aria-modal="true" aria-label="已注册用户">
            <header class="registered-users-dialog__header">
                <div class="registered-users-dialog__header-copy">
                    <h3>已注册用户</h3>
                    <p>${escapeHtml(vm.subtitle)}</p>
                </div>
                <button class="registered-users-dialog__ghost" data-registered-users-action="close" type="button" aria-label="关闭已注册用户">
                    <span class="material-icons-outlined">close</span>
                </button>
            </header>
            <div class="registered-users-dialog__body">
                ${buildBodyContent(vm)}
            </div>
        </section>
    </div>
`;
