import { escapeHtml } from "../../shared/lib/helpers.js";

const buildMemberActions = (member) => {
    if (!member.canPromote && !member.canDemote && !member.canRemove) {
        return "";
    }

    return `
        <div class="member-list-dialog__actions">
            ${member.canPromote ? `
                <button class="member-list-dialog__action" data-member-list-action="promote" data-member-list-identity-id="${escapeHtml(member.identityId)}" ${member.actionsLocked ? "disabled" : ""} type="button">
                    ${member.isBusy ? "处理中" : "设为管理员"}
                </button>
            ` : ""}
            ${member.canDemote ? `
                <button class="member-list-dialog__action" data-member-list-action="demote" data-member-list-identity-id="${escapeHtml(member.identityId)}" ${member.actionsLocked ? "disabled" : ""} type="button">
                    ${member.isBusy ? "处理中" : "取消管理员"}
                </button>
            ` : ""}
            ${member.canRemove ? `
                <button class="member-list-dialog__action member-list-dialog__action--danger" data-member-list-action="request-remove" data-member-list-identity-id="${escapeHtml(member.identityId)}" ${member.actionsLocked ? "disabled" : ""} type="button">
                    ${member.isBusy ? "处理中" : "移除成员"}
                </button>
            ` : ""}
        </div>
    `;
};

const buildRemoveConfirm = (member) => {
    if (!member.confirmRemove) {
        return "";
    }

    return `
        <div class="member-list-dialog__confirm">
            <div class="member-list-dialog__confirm-copy">移除后将失去频道访问权限，但历史内容会保留。</div>
            <div class="member-list-dialog__confirm-actions">
                <button class="member-list-dialog__confirm-button" data-member-list-action="cancel-remove" type="button" ${member.actionsLocked ? "disabled" : ""}>取消</button>
                <button class="member-list-dialog__confirm-button member-list-dialog__confirm-button--danger" data-member-list-action="confirm-remove" data-member-list-identity-id="${escapeHtml(member.identityId)}" type="button" ${member.actionsLocked ? "disabled" : ""}>
                    ${member.isBusy ? "移除中" : "确认移除"}
                </button>
            </div>
        </div>
    `;
};

const buildMemberItem = (member) => `
    <div class="member-list-dialog__item">
        <div class="member-list-dialog__row">
            <img alt="${escapeHtml(member.name)}" class="member-list-dialog__avatar" src="${member.avatar}" />
            <div class="member-list-dialog__copy">
                <div class="member-list-dialog__name">${escapeHtml(member.name)}</div>
                <div class="member-list-dialog__meta">${escapeHtml(member.roleLabel)}</div>
            </div>
            <span class="member-list-dialog__role">${escapeHtml(member.roleLabel)}</span>
        </div>
        ${buildMemberActions(member)}
        ${buildRemoveConfirm(member)}
    </div>
`;

const buildBodyContent = (vm) => {
    if (vm.loading) {
        return '<div class="member-list-dialog__status">正在同步成员目录...</div>';
    }

    if (vm.error) {
        return `<div class="member-list-dialog__status member-list-dialog__status--error">${escapeHtml(vm.error)}</div>`;
    }

    if (!vm.members.length) {
        return '<div class="member-list-dialog__empty">当前还没有可展示的成员。</div>';
    }

    return vm.members.map(buildMemberItem).join("");
};

export const memberListDialogTemplate = (vm) => `
    <div class="member-list-dialog ${vm.open ? "is-open" : ""}" aria-hidden="${vm.open ? "false" : "true"}">
        <div class="member-list-dialog__backdrop" data-member-list-action="close"></div>
        <section class="member-list-dialog__panel" role="dialog" aria-modal="true" aria-label="频道成员">
            <header class="member-list-dialog__header">
                <div class="member-list-dialog__header-copy">
                    <h3>频道成员</h3>
                    <p>${escapeHtml(vm.subtitle)}</p>
                </div>
                <button class="member-list-dialog__ghost" data-member-list-action="close" type="button" aria-label="关闭成员名单">
                    <span class="material-icons-outlined">close</span>
                </button>
            </header>
            <div class="member-list-dialog__body">
                ${buildBodyContent(vm)}
            </div>
        </section>
    </div>
`;
