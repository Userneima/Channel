import { escapeHtml } from "../../shared/lib/helpers.js";

export const sidebarNavTemplate = (vm) => `
    <div class="sidebar-nav__mobile-bar">
        <button class="sidebar-nav__mobile-trigger" data-sidebar-action="toggle" type="button">
            <span class="material-icons-outlined">menu</span>
        </button>
        <a class="sidebar-nav__brand" href="${escapeHtml(vm.brandHref || "?")}">${escapeHtml(vm.brandName)}</a>
    </div>
    <div class="sidebar-nav__overlay ${vm.sidebarOpen ? "is-open" : ""}" data-sidebar-action="close"></div>
    <div class="sidebar-nav__panel ${vm.sidebarOpen ? "is-open" : ""}">
        <div class="sidebar-nav__header">
            <a class="sidebar-nav__brand-mark" href="${escapeHtml(vm.brandHref || "?")}">
                <span class="material-icons-outlined">tag</span>
                <span>${escapeHtml(vm.brandName)}</span>
            </a>
        </div>
        <button class="sidebar-nav__search" data-sidebar-action="search" type="button">
            <span class="material-icons-outlined">search</span>
            <span class="sidebar-nav__search-placeholder">在当前回合搜索</span>
        </button>
        ${vm.demoPromo ? `
            <div class="sidebar-nav__section sidebar-nav__section--promo">
                <div class="sidebar-nav__promo">
                    <div class="sidebar-nav__promo-eyebrow">${escapeHtml(vm.demoPromo.eyebrow)}</div>
                    <h3>${escapeHtml(vm.demoPromo.title)}</h3>
                    ${vm.demoPromo.description ? `<p>${escapeHtml(vm.demoPromo.description)}</p>` : ""}
                    <a class="sidebar-nav__promo-primary" href="${escapeHtml(vm.demoPromo.primaryHref)}">${escapeHtml(vm.demoPromo.primaryLabel)}</a>
                    ${vm.demoPromo.note ? `<div class="sidebar-nav__promo-note">${escapeHtml(vm.demoPromo.note)}</div>` : ""}
                </div>
            </div>
        ` : `
            <div class="sidebar-nav__section">
                <div class="sidebar-nav__section-title">主页导航</div>
                <nav class="sidebar-nav__links">
                    ${vm.navItems.map((item) => `
                        <a class="sidebar-nav__link" href="${escapeHtml(item.href || "#")}">
                            <span class="material-icons-outlined">${item.icon}</span>
                            <span>${escapeHtml(item.label)}</span>
                        </a>
                    `).join("")}
                </nav>
            </div>
        `}
        ${vm.unjoinedItems.length ? `
            <div class="sidebar-nav__section">
                <div class="sidebar-nav__section-title">未加入的频道</div>
                <nav class="sidebar-nav__links">
                    ${vm.unjoinedItems.map((item) => `
                        <a class="sidebar-nav__channel" href="${escapeHtml(item.href || "#")}">
                            <img alt="${escapeHtml(item.name)}" class="sidebar-nav__channel-avatar" src="${item.avatar}" />
                            <div class="sidebar-nav__channel-text">${escapeHtml(item.name)}</div>
                        </a>
                    `).join("")}
                </nav>
            </div>
        ` : ""}
        <div class="sidebar-nav__section">
            <div class="sidebar-nav__section-title">游戏轮次</div>
            <nav class="sidebar-nav__links">
                ${vm.roundItems.map((item) => `
                    <button
                        class="sidebar-nav__channel ${item.active ? "is-active" : ""}"
                        data-sidebar-round-id="${escapeHtml(item.id || "")}"
                        data-sidebar-round-kind="${escapeHtml(item.kind || "current")}"
                        type="button"
                    >
                        ${item.avatar
        ? `<img alt="${escapeHtml(item.name)}" class="sidebar-nav__channel-avatar" src="${item.avatar}" />`
        : `<div class="sidebar-nav__channel-badge">${escapeHtml(item.badge)}</div>`}
                        <span class="sidebar-nav__channel-text">
                            <span class="sidebar-nav__channel-name">${escapeHtml(item.name)}</span>
                            ${item.meta ? `<span class="sidebar-nav__channel-meta">${escapeHtml(item.meta)}</span>` : ""}
                        </span>
                    </button>
                `).join("")}
            </nav>
        </div>
        <div class="sidebar-nav__footer" data-sidebar-ref="account-shell">
            ${vm.isDemoMode ? `
                <a class="sidebar-nav__identity" href="${escapeHtml(vm.demoHref)}">
                    <img alt="${escapeHtml(vm.currentIdentity.name)}" class="sidebar-nav__identity-avatar" src="${vm.currentIdentity.avatar}" />
                    <span class="sidebar-nav__identity-text">
                        <span class="sidebar-nav__identity-name">${escapeHtml(vm.currentIdentity.name)}</span>
                        ${vm.currentUserEmail ? `<span class="sidebar-nav__identity-email">${escapeHtml(vm.currentUserEmail)}</span>` : ""}
                    </span>
                    <span class="material-icons-outlined sidebar-nav__identity-arrow">login</span>
                </a>
            ` : `
                <button
                    aria-expanded="${vm.isAuthenticated && vm.accountMenuOpen ? "true" : "false"}"
                    class="sidebar-nav__identity"
                    data-sidebar-action="${vm.isAuthenticated ? "toggle-account-menu" : "login"}"
                    type="button"
                >
                    <img alt="${escapeHtml(vm.currentIdentity.name)}" class="sidebar-nav__identity-avatar" src="${vm.currentIdentity.avatar}" />
                    <span class="sidebar-nav__identity-text">
                        <span class="sidebar-nav__identity-name">${escapeHtml(vm.currentIdentity.name)}</span>
                        ${vm.currentUserEmail ? `<span class="sidebar-nav__identity-email">${escapeHtml(vm.currentUserEmail)}</span>` : ""}
                    </span>
                    <span class="material-icons-outlined sidebar-nav__identity-arrow">${vm.isAuthenticated ? (vm.accountMenuOpen ? "expand_less" : "expand_more") : "login"}</span>
                </button>
            `}
            ${vm.isAuthenticated && vm.accountMenuOpen ? `
                <div class="sidebar-nav__account-menu">
                    <button class="sidebar-nav__account-action" data-sidebar-action="identity" type="button">
                        <span class="material-icons-outlined">badge</span>
                        <span>身份设置</span>
                    </button>
                    ${vm.canLogout ? `
                        <button class="sidebar-nav__account-action" data-sidebar-action="logout" type="button">
                            <span class="material-icons-outlined">logout</span>
                            <span>退出登录</span>
                        </button>
                    ` : ""}
                </div>
            ` : ""}
        </div>
    </div>
`;
