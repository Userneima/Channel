import { escapeHtml } from "../../shared/lib/helpers.js";

const buildNotificationItem = (item) => `
    <article class="notification-center__item">
        <img alt="${escapeHtml(item.userName)}" class="notification-center__avatar" src="${item.avatar}" />
        <div class="notification-center__item-body">
            <div class="notification-center__item-head">
                <span class="notification-center__name">${escapeHtml(item.userName)}</span>
                <span class="notification-center__date">${escapeHtml(item.dateLabel)}</span>
            </div>
            <div class="notification-center__item-action">${escapeHtml(item.actionLine)}</div>
            <div class="notification-center__quote">${escapeHtml(item.quoteLine)}</div>
        </div>
    </article>
`;

export const notificationCenterTemplate = (vm) => `
    <div class="notification-center ${vm.open ? "is-open" : ""}">
        <div class="notification-center__backdrop" data-notification-center-action="close"></div>
        <div class="notification-center__panel" style="${vm.panelStyle}">
            <div class="notification-center__tabs">
                ${vm.tabs.map((tab) => `
                    <button
                        class="notification-center__tab ${vm.activeTab === tab.key ? "is-active" : ""}"
                        data-notification-center-action="tab"
                        data-tab-key="${tab.key}"
                        type="button"
                    >
                        ${escapeHtml(tab.label)}
                        ${typeof tab.count === "number" ? `<span class="notification-center__tab-count">${tab.count}</span>` : ""}
                    </button>
                `).join("")}
            </div>
            <div class="notification-center__list">
                ${vm.items.length
        ? vm.items.map((item) => buildNotificationItem(item)).join("")
        : `
                    <div class="notification-center__empty">
                        <div class="notification-center__empty-title">${escapeHtml(vm.emptyTitle)}</div>
                        <div class="notification-center__empty-copy">${escapeHtml(vm.emptyDescription)}</div>
                    </div>
                `}
            </div>
        </div>
    </div>
`;
