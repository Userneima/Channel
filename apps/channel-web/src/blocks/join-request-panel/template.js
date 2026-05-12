import { escapeHtml } from "../../shared/lib/helpers.js";

export const joinRequestPanelTemplate = (vm) => {
    if (!vm.visible) {
        return "";
    }

    return `
        <section class="join-request-panel">
            <div class="join-request-panel__copy">
                <h3>${escapeHtml(vm.title)}</h3>
                <p>${escapeHtml(vm.description)}</p>
                ${vm.error ? `<div class="join-request-panel__error">${escapeHtml(vm.error)}</div>` : ""}
            </div>
            <div class="join-request-panel__actions">
                <button
                    class="join-request-panel__primary"
                    data-join-request-action="${escapeHtml(vm.primaryAction || "")}"
                    ${vm.canSubmit || vm.primaryAction === "login" || vm.primaryAction === "upgrade" ? "" : "disabled"}
                    type="button"
                >
                    ${vm.submitStatus === "submitting" ? "提交中" : escapeHtml(vm.primaryLabel)}
                </button>
            </div>
        </section>
    `;
};
