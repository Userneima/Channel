import { anonymizeComposerText, looksLikeAnsweredPromptInsteadOfRewrite } from "../../shared/lib/helpers.js";

export const createAnonymousPreviewController = ({ store, dataService, resolveAnonymousComposerMode }) => {
    let anonymousPreviewTimer = null;
    let anonymousPreviewRequestId = 0;

    const clearAnonymousPreviewTimer = () => {
        if (anonymousPreviewTimer) {
            window.clearTimeout(anonymousPreviewTimer);
            anonymousPreviewTimer = null;
        }
    };

    const resetAnonymousPreview = () => {
        clearAnonymousPreviewTimer();
        anonymousPreviewRequestId += 1;
        const currentState = store.getState().composerState;
        if (
            currentState.anonymousPreviewStatus === "idle"
            && !currentState.anonymousPreviewText
            && !currentState.anonymousPreviewSourceText
        ) {
            return;
        }
        store.dispatch({
            type: "composer/set-field",
            payload: {
                anonymousPreviewStatus: "idle",
                anonymousPreviewText: "",
                anonymousPreviewSourceText: ""
            }
        });
    };

    const buildAnonymousPreviewText = async (rawText, state) => {
        const normalizedText = String(rawText || "").trim();
        if (!normalizedText) {
            return "";
        }

        try {
            const draft = await dataService.anonymizeAnonymousDraft?.({
                text: normalizedText,
                purpose: "post",
                channelId: state.runtimeState.channel?.id || null,
                images: [],
                reshapeImages: false
            });
            const rewrittenText = String(draft?.text || "").trim();
            if (rewrittenText && !looksLikeAnsweredPromptInsteadOfRewrite(normalizedText, rewrittenText)) {
                return rewrittenText;
            }
            return anonymizeComposerText(normalizedText);
        } catch {
            return anonymizeComposerText(normalizedText);
        }
    };

    const refreshAnonymousPreview = async ({ immediate = false, force = false } = {}) => {
        clearAnonymousPreviewTimer();

        const state = store.getState();
        const rawText = state.composerState.draftText.trim();
        const anonymousMode = resolveAnonymousComposerMode(state);
        const rewriteEnabled = anonymousMode && state.composerState.anonymousTextRewrite;

        if (!rewriteEnabled || !rawText) {
            resetAnonymousPreview();
            return "";
        }

        if (
            !force
            && state.composerState.anonymousPreviewStatus === "ready"
            && state.composerState.anonymousPreviewSourceText === rawText
        ) {
            return state.composerState.anonymousPreviewText;
        }

        const runPreview = async () => {
            const latestState = store.getState();
            const latestText = latestState.composerState.draftText.trim();
            if (!resolveAnonymousComposerMode(latestState) || !latestState.composerState.anonymousTextRewrite || !latestText) {
                resetAnonymousPreview();
                return "";
            }

            const requestId = ++anonymousPreviewRequestId;
            store.dispatch({
                type: "composer/set-field",
                payload: {
                    anonymousPreviewStatus: "loading",
                    anonymousPreviewText: "",
                    anonymousPreviewSourceText: latestText
                }
            });

            const previewText = await buildAnonymousPreviewText(latestText, latestState);
            if (requestId !== anonymousPreviewRequestId) {
                return previewText;
            }

            store.dispatch({
                type: "composer/set-field",
                payload: {
                    anonymousPreviewStatus: "ready",
                    anonymousPreviewText: previewText,
                    anonymousPreviewSourceText: latestText
                }
            });
            return previewText;
        };

        if (immediate) {
            return runPreview();
        }

        anonymousPreviewTimer = window.setTimeout(() => {
            void runPreview();
        }, 260);
        return "";
    };

    return {
        resetAnonymousPreview,
        refreshAnonymousPreview
    };
};
