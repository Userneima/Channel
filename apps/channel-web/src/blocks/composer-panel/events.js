export const attachComposerPanelEvents = ({ root, actions }) => {
    root.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        if (!target.closest(".composer-panel__disclosure-wrap")) {
            actions.closeAiDisclosureMenu();
        }
        if (!target.closest(".composer-panel__mention-wrap")) {
            actions.closeMentionMenu();
        }
        if (!target.closest(".composer-panel__proxy-wrap")) {
            actions.closeProxyWishMenu();
        }
    });

    root.addEventListener("click", (event) => {
        const actionButton = event.target.closest("[data-composer-action]");
        const disclosureOption = event.target.closest("[data-ai-disclosure-value]");

        if (disclosureOption) {
            actions.selectAiDisclosure(disclosureOption.dataset.aiDisclosureValue);
            return;
        }

        const mentionOption = event.target.closest("[data-mention-member-name]");
        if (mentionOption) {
            actions.selectMentionTarget({
                name: mentionOption.dataset.mentionMemberName,
                avatar: mentionOption.dataset.mentionMemberAvatar || ""
            });
            return;
        }

        const proxyOption = event.target.closest("[data-proxy-member-name]");
        if (proxyOption) {
            actions.selectProxyWishTarget({
                name: proxyOption.dataset.proxyMemberName,
                avatar: proxyOption.dataset.proxyMemberAvatar || "",
                userId: proxyOption.dataset.proxyMemberUserId || null,
                identityId: proxyOption.dataset.proxyMemberIdentityId || null
            });
            return;
        }

        if (!actionButton) {
            return;
        }

        const action = actionButton.dataset.composerAction;
        if (action === "open-identity") {
            actions.openOverlay("identity");
            return;
        }
        if (action === "expand") {
            actions.expandComposer();
            return;
        }
        if (action === "collapse") {
            actions.collapseComposer();
            return;
        }
        if (action === "toggle-anonymous") {
            actions.toggleAnonymousMode();
            return;
        }
        if (action === "toggle-mention") {
            actions.toggleMentionMenu();
            return;
        }
        if (action === "toggle-proxy-wish") {
            actions.toggleProxyWishMenu();
            return;
        }
        if (action === "clear-mention") {
            actions.clearMentionTarget();
            return;
        }
        if (action === "clear-proxy-wish") {
            actions.clearProxyWishTarget();
            return;
        }
        if (action === "rotate-alias") {
            actions.rotateAliasProfile();
            return;
        }
        if (action === "regenerate-alias") {
            void actions.regenerateAliasProfile();
            return;
        }
        if (action === "toggle-ai-disclosure") {
            actions.toggleAiDisclosureMenu();
            return;
        }
        if (action === "open-auth-login") {
            actions.openAuthGate("login");
            return;
        }
        if (action === "open-auth-upgrade") {
            actions.openAuthGate("upgrade");
            return;
        }
        if (action === "submit-join-request") {
            void actions.submitJoinRequest();
        }
    });

    root.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        if (target.matches("[data-ref='draft-input']")) {
            actions.setComposerField({ draftText: target.value });
            void actions.refreshAnonymousTextPreview();
        }
    });

    root.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        if (target.matches("[data-ref='ai-disclosure-select']")) {
            actions.setComposerField({ aiDisclosure: target.value });
            return;
        }

        if (target.matches("[data-ref='board-select']")) {
            actions.setComposerField({ board: target.value });
            return;
        }

        if (target.matches("[data-ref='anonymous-text-rewrite']")) {
            void actions.setAnonymousTextRewrite(target.checked);
            return;
        }

        if (target.matches("[data-ref='ai-image-reshape']")) {
            actions.setComposerField({ aiImageReshape: target.checked });
            return;
        }

        if (target.matches("[data-ref='image-input']")) {
            void actions.addComposerImages(target.files);
            target.value = "";
            return;
        }

        if (target.matches("[data-ref='image-input-secondary']")) {
            void actions.addComposerImages(target.files);
            target.value = "";
        }
    });
};
