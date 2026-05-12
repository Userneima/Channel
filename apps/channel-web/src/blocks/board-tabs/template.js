import { escapeHtml } from "../../shared/lib/helpers.js";

export const boardTabsTemplate = (vm) => `
    <div class="board-tabs">
        <div class="board-tabs__main">
            <div class="board-tabs__filters">
                <button
                    aria-expanded="${vm.filterMenuOpen ? "true" : "false"}"
                    class="board-tabs__filter board-tabs__filter--icon ${vm.filterMenuOpen ? "is-open" : ""}"
                    data-board-tabs-action="toggle-filters"
                    type="button"
                >
                    <span class="material-icons-outlined">swap_vert</span>
                </button>
                ${vm.filterMenuOpen ? `
                    <div class="board-tabs__filter-menu">
                        ${vm.filters.map((filter) => `
                            <button
                                class="board-tabs__filter-menu-item ${filter.value === vm.activeFilter ? "is-active" : ""}"
                                data-filter="${filter.value}"
                                type="button"
                            >
                                <span>${escapeHtml(filter.label)}</span>
                                ${filter.value === vm.activeFilter ? '<span class="material-icons-outlined">done</span>' : ""}
                            </button>
                        `).join("")}
                    </div>
                ` : ""}
            </div>
            <div class="board-tabs__boards">
                ${vm.boards.map((board) => `
                    <button
                        aria-disabled="${board.disabled ? "true" : "false"}"
                        class="board-tabs__board ${board.value === vm.activeBoard ? "is-active" : ""} ${board.disabled ? "is-disabled" : ""}"
                        data-board="${board.value}"
                        title="${board.disabled ? `当前回合还没开放「${escapeHtml(board.label)}」` : ""}"
                        type="button"
                    >
                        ${escapeHtml(board.label)}
                    </button>
                `).join("")}
            </div>
            <button class="board-tabs__quick-compose" data-board-tabs-action="compose" type="button">
                <span class="material-icons-outlined">edit</span>
                <span>发帖</span>
            </button>
        </div>
    </div>
`;
