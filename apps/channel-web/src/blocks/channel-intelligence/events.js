export const attachChannelIntelligenceEvents = ({ root, roots = [], actions }) => {
    const targets = Array.from(new Set([root, ...roots].filter(Boolean)));

    const bindTarget = (target) => {
        target.addEventListener("click", (event) => {
            const panelAction = event.target.closest("[data-channel-intelligence-action]");
            if (panelAction) {
                const action = panelAction.dataset.channelIntelligenceAction;
                if (action === "toggle-god-picker") {
                    actions.toggleRoundGodPicker();
                    return;
                }
                if (action === "toggle-theme-editor") {
                    actions.toggleRoundThemeEditor();
                    return;
                }
                if (action === "cancel-theme") {
                    actions.cancelRoundThemeEditing();
                    return;
                }
                if (action === "save-theme") {
                    actions.saveRoundTheme();
                    return;
                }
                if (action === "toggle-reveal-editor") {
                    actions.toggleRoundRevealEditor();
                    return;
                }
                if (action === "generate-reveal-results") {
                    void actions.generateRoundRevealResults();
                    return;
                }
                if (action === "toggle-reveal-member-picker") {
                    actions.toggleRoundRevealMemberPicker();
                    return;
                }
                if (action === "toggle-reveal-angel-picker") {
                    actions.toggleRoundRevealAngelPicker();
                    return;
                }
                if (action === "save-reveal-pair") {
                    actions.saveRoundRevealPair();
                    return;
                }
                if (action === "archive-current-round") {
                    void actions.completeRoundCycle();
                    return;
                }
                if (action === "force-archive-current-round") {
                    void actions.forceArchiveCurrentRound();
                    return;
                }
                if (action === "restore-archive") {
                    void actions.restoreArchivedRound();
                    return;
                }
                if (action === "rename-archive") {
                    void actions.renameArchivedRound();
                    return;
                }
                if (action === "delete-archive") {
                    void actions.deleteArchivedRound();
                    return;
                }
                if (action === "export-archive") {
                    void actions.exportArchivedRound();
                    return;
                }
                if (action === "view-archive-board") {
                    void actions.viewSelectedArchiveInBoard();
                    return;
                }
                if (action === "close-archive-detail") {
                    actions.closeArchiveDetail();
                    return;
                }
                if (action === "exit-archive-viewer") {
                    void actions.exitArchiveViewer();
                    return;
                }
            }

            const godOption = event.target.closest("[data-channel-intelligence-god]");
            if (godOption) {
                actions.assignRoundGod({
                    name: godOption.dataset.channelIntelligenceGod,
                    avatar: godOption.dataset.channelIntelligenceAvatar || "",
                    userId: godOption.dataset.channelIntelligenceUserId || null
                });
                return;
            }

            const archiveOption = event.target.closest("[data-channel-intelligence-archive]");
            if (archiveOption) {
                void actions.selectRoundArchive(archiveOption.dataset.channelIntelligenceArchive || "");
                return;
            }

            const revealMemberOption = event.target.closest("[data-channel-intelligence-member]");
            if (revealMemberOption) {
                actions.chooseRoundRevealMember({
                    name: revealMemberOption.dataset.channelIntelligenceMember,
                    avatar: revealMemberOption.dataset.channelIntelligenceAvatar || ""
                });
                return;
            }

            const revealAngelOption = event.target.closest("[data-channel-intelligence-angel]");
            if (revealAngelOption) {
                actions.chooseRoundRevealAngel({
                    name: revealAngelOption.dataset.channelIntelligenceAngel,
                    avatar: revealAngelOption.dataset.channelIntelligenceAvatar || ""
                });
            }
        });

        target.addEventListener("input", (event) => {
            const input = event.target.closest("[data-channel-intelligence-ref='theme-input']");
            if (!input) {
                return;
            }

            actions.setRoundThemeDraft(input.value);
        });
    };

    targets.forEach(bindTarget);
};
