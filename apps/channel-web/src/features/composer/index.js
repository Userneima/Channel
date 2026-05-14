import { createAnonymousPreviewController } from "./anonymous-preview.js";
import { ensureApprovedMember, resolveAnonymousComposerMode } from "./access.js";
import { createComposerIdentityActions } from "./identity-actions.js";
import { createComposerPostActions } from "./post-submission.js";

export const createComposerActions = ({ store, dataService, showToast, feedActions }) => {
    const { resetAnonymousPreview, refreshAnonymousPreview } = createAnonymousPreviewController({
        store,
        dataService,
        resolveAnonymousComposerMode
    });

    const openAuthGateForGuest = (mode) => {
        store.dispatch({
            type: "auth-gate/open",
            payload: { mode: mode === "upgrade" ? "upgrade" : "login" }
        });
    };

    const ensureMemberAccess = ({ unapprovedMessage }) => ensureApprovedMember(
        store,
        openAuthGateForGuest,
        () => {
            showToast({
                tone: "info",
                message: unapprovedMessage
            });
        }
    );

    const actions = {
        expandComposer() {
            store.dispatch({ type: "composer/expand" });
        },
        collapseComposer() {
            store.dispatch({ type: "composer/collapse" });
        },
        setComposerField(partial) {
            store.dispatch({
                type: "composer/set-field",
                payload: partial
            });
        },
        toggleEmojiMenu() {
            const { emojiOpen } = store.getState().composerState;
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    emojiOpen: !emojiOpen,
                    mentionOpen: false,
                    proxyWishOpen: false,
                    aiDisclosureOpen: false
                }
            });
        },
        closeEmojiMenu() {
            if (!store.getState().composerState.emojiOpen) {
                return;
            }
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    emojiOpen: false
                }
            });
        },
        insertEmoji(emoji, { selectionStart, selectionEnd } = {}) {
            const normalizedEmoji = String(emoji || "");
            if (!normalizedEmoji) {
                return null;
            }

            const state = store.getState().composerState;
            const draftText = String(state.draftText || "");
            const safeStart = Number.isInteger(selectionStart) ? selectionStart : state.selectionStart;
            const safeEnd = Number.isInteger(selectionEnd) ? selectionEnd : state.selectionEnd;
            const start = Math.max(0, Math.min(draftText.length, safeStart ?? draftText.length));
            const end = Math.max(start, Math.min(draftText.length, safeEnd ?? start));
            const nextDraftText = `${draftText.slice(0, start)}${normalizedEmoji}${draftText.slice(end)}`;
            const nextCaret = start + normalizedEmoji.length;

            store.dispatch({
                type: "composer/set-field",
                payload: {
                    draftText: nextDraftText,
                    selectionStart: nextCaret,
                    selectionEnd: nextCaret,
                    emojiOpen: false,
                    expanded: true
                }
            });
            void refreshAnonymousPreview();
            return {
                start: nextCaret,
                end: nextCaret
            };
        },
        async refreshAnonymousTextPreview(options = {}) {
            return refreshAnonymousPreview(options);
        },
        toggleMentionMenu() {
            const { mentionOpen } = store.getState().composerState;
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    mentionOpen: !mentionOpen,
                    proxyWishOpen: false,
                    emojiOpen: false
                }
            });
        },
        toggleProxyWishMenu() {
            const { proxyWishOpen } = store.getState().composerState;
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    proxyWishOpen: !proxyWishOpen,
                    mentionOpen: false,
                    emojiOpen: false
                }
            });
        },
        closeMentionMenu() {
            if (!store.getState().composerState.mentionOpen) {
                return;
            }
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    mentionOpen: false
                }
            });
        },
        closeProxyWishMenu() {
            if (!store.getState().composerState.proxyWishOpen) {
                return;
            }
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    proxyWishOpen: false
                }
            });
        },
        selectMentionTarget(member) {
            const state = store.getState();
            if (state.roundState.activeStage === "guess" && member?.name && state.roundState.guessExcludedNames?.includes(member.name)) {
                store.dispatch({
                    type: "round/toggle-guess-exclusion",
                    payload: { name: member.name }
                });
            }
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    mentionTarget: member ? {
                        name: member.name,
                        avatar: member.avatar || ""
                    } : null,
                    mentionOpen: false
                }
            });
        },
        selectProxyWishTarget(member) {
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    proxyWishTarget: member ? {
                        name: member.name,
                        avatar: member.avatar || "",
                        userId: member.userId || null,
                        identityId: member.identityId || null
                    } : null,
                    proxyWishOpen: false
                }
            });
        },
        setGuessDraftText(value) {
            if (store.getState().roundState.activeStage !== "guess") {
                return;
            }
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    draftText: String(value || "")
                }
            });
        },
        toggleGuessExcludedMember(name) {
            const normalizedName = String(name || "").trim();
            if (!normalizedName || store.getState().roundState.activeStage !== "guess") {
                return;
            }
            store.dispatch({
                type: "round/toggle-guess-exclusion",
                payload: { name: normalizedName }
            });
        },
        async submitGuessStage() {
            if (store.getState().roundState.activeStage !== "guess") {
                return;
            }
            await this.submitPost();
        },
        clearMentionTarget() {
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    mentionTarget: null,
                    mentionOpen: false
                }
            });
        },
        clearProxyWishTarget() {
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    proxyWishTarget: null,
                    proxyWishOpen: false
                }
            });
        },
        toggleAiDisclosureMenu() {
            const { anonymousMode, aiDisclosureOpen } = store.getState().composerState;
            if (anonymousMode) {
                return;
            }
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    aiDisclosureOpen: !aiDisclosureOpen,
                    emojiOpen: false
                }
            });
        },
        selectAiDisclosure(value) {
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    aiDisclosure: value,
                    aiDisclosureOpen: false
                }
            });
        },
        closeAiDisclosureMenu() {
            if (!store.getState().composerState.aiDisclosureOpen) {
                return;
            }
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    aiDisclosureOpen: false
                }
            });
        },
        async setAnonymousTextRewrite(enabled) {
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    anonymousTextRewrite: Boolean(enabled)
                }
            });

            if (enabled) {
                await refreshAnonymousPreview({ immediate: true, force: true });
                return;
            }

            resetAnonymousPreview();
        },
        toggleAnonymousMode() {
            if (!ensureMemberAccess({
                unapprovedMessage: "进入频道后，才能使用匿名发言。"
            })) {
                return;
            }
            store.dispatch({ type: "composer/expand" });
            store.dispatch({ type: "composer/toggle-anonymous" });
            const state = store.getState();
            if (resolveAnonymousComposerMode(state) && state.composerState.anonymousTextRewrite) {
                void refreshAnonymousPreview({ immediate: true, force: true });
                return;
            }
            resetAnonymousPreview();
        },
        rotateAliasProfile() {
            if (!ensureMemberAccess({
                unapprovedMessage: "进入频道后，才能切换匿名马甲。"
            })) {
                return;
            }
            const { anonymousProfiles, activeAliasKey } = store.getState().runtimeState;
            if (!anonymousProfiles.length) {
                return;
            }
            const currentIndex = anonymousProfiles.findIndex((profile) => profile.key === activeAliasKey);
            const nextProfile = anonymousProfiles[(currentIndex + 1 + anonymousProfiles.length) % anonymousProfiles.length];
            store.dispatch({
                type: "runtime/set-alias-key",
                payload: { key: nextProfile.key }
            });
        },
    };

    Object.assign(actions, createComposerPostActions({
        store,
        dataService,
        showToast,
        feedActions,
        ensureMemberAccess,
        resolveAnonymousComposerMode,
        refreshAnonymousPreview,
        resetAnonymousPreview,
        actions
    }));

    Object.assign(actions, createComposerIdentityActions({
        store,
        dataService,
        showToast,
        ensureMemberAccess
    }));

    return actions;
};
