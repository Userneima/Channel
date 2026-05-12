import "./styles.css";
import { attachComposerPanelEvents } from "./events.js";
import { selectComposerPanelVM } from "./selectors.js";
import { composerPanelTemplate } from "./template.js";
import { createAudioDraftFromBlob, revokeComposerAudioDraft } from "../../shared/lib/helpers.js";

const renderImages = (container, images) => {
    container.innerHTML = images.map((image) => `
        <div class="composer-panel__image" data-image-id="${image.id}">
            <img alt="${image.name}" src="${image.url}" />
            <button class="composer-panel__remove-image" data-remove-image="${image.id}" type="button">
                <span class="material-icons-outlined">close</span>
            </button>
        </div>
    `).join("");
};

const syncDraftInputHeight = (input) => {
    if (!input) {
        return;
    }

    input.style.height = "0px";
    const computedStyle = window.getComputedStyle(input);
    const maxHeight = Number.parseFloat(computedStyle.maxHeight) || 0;
    const nextHeight = input.scrollHeight;
    if (maxHeight > 0 && nextHeight > maxHeight) {
        input.style.height = `${maxHeight}px`;
        input.style.overflowY = "auto";
        return;
    }

    input.style.height = `${nextHeight}px`;
    input.style.overflowY = "hidden";
};

export const mountComposerPanelBlock = ({ root, store, actions }) => {
    let refs = null;
    let hasBoundEvents = false;
    let previousCanCompose = null;
    let previousExpanded = null;
    let previousAnonymousMode = null;
    let previousAliasSignature = "";
    let previousMentionSignature = "";
    let previousStageSignature = "";
    let previousClaimSignature = "";
    let previousAudioSignature = "";
    let recorder = null;
    let recorderStream = null;
    let recorderChunks = [];

    const stopRecorderStream = () => {
        if (!recorderStream) {
            return;
        }
        recorderStream.getTracks().forEach((track) => track.stop());
        recorderStream = null;
    };

    const finishRecording = () => new Promise((resolve) => {
        if (!recorder || recorder.state === "inactive") {
            stopRecorderStream();
            recorder = null;
            resolve(null);
            return;
        }

        recorder.onstop = () => {
            const nextChunks = [...recorderChunks];
            recorderChunks = [];
            stopRecorderStream();
            recorder = null;
            const mimeType = nextChunks[0]?.type || "audio/webm";
            resolve(nextChunks.length ? new Blob(nextChunks, { type: mimeType }) : null);
        };
        recorder.stop();
    });

    const startRecording = async () => {
        if (recorder?.state === "recording") {
            return;
        }

        const mediaDevices = navigator.mediaDevices;
        if (!mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
            actions.showToast?.({
                tone: "info",
                message: "当前浏览器暂不支持录音。"
            });
            return;
        }

        try {
            const stream = await mediaDevices.getUserMedia({ audio: true });
            recorderStream = stream;
            recorderChunks = [];
            recorder = new MediaRecorder(stream);
            recorder.ondataavailable = (event) => {
                if (event.data?.size) {
                    recorderChunks.push(event.data);
                }
            };
            recorder.start();
            store.dispatch({
                type: "composer/set-recording",
                payload: {
                    recording: true,
                    expand: true
                }
            });
        } catch (error) {
            stopRecorderStream();
            recorder = null;
            recorderChunks = [];
            actions.showToast?.({
                tone: "error",
                message: error?.name === "NotAllowedError"
                    ? "没有拿到麦克风权限，无法开始录音。"
                    : "录音启动失败，请稍后再试。"
            });
        }
    };

    const toggleRecording = async () => {
        if (recorder?.state === "recording") {
            store.dispatch({
                type: "composer/set-recording",
                payload: { recording: false }
            });
            const blob = await finishRecording();
            if (!blob?.size) {
                return;
            }
            const state = store.getState();
            const nextAudioId = state.composerState.nextAudioId;
            const previousAudioDraft = state.composerState.audioDraft;
            if (previousAudioDraft) {
                revokeComposerAudioDraft(previousAudioDraft);
            }
            store.dispatch({
                type: "composer/set-audio-draft",
                payload: {
                    audio: createAudioDraftFromBlob(blob, nextAudioId),
                    nextAudioId: nextAudioId + 1
                }
            });
            return;
        }

        await startRecording();
    };

    const ensureRefs = () => {
        refs = {
            draftInput: root.querySelector("[data-ref='draft-input']"),
            imageList: root.querySelector("[data-ref='image-list']"),
            identityAvatar: root.querySelector("[data-ref='identity-avatar']"),
            identityName: root.querySelector("[data-ref='identity-name']"),
            identityMeta: root.querySelector("[data-ref='identity-meta']"),
            anonymousIcon: root.querySelector("[data-ref='anonymous-icon']"),
            anonymousTextRewrite: root.querySelector("[data-ref='anonymous-text-rewrite']"),
            anonymousPreview: root.querySelector("[data-ref='anonymous-preview']"),
            anonymousPreviewBody: root.querySelector("[data-ref='anonymous-preview-body']"),
            aiDisclosureSelect: root.querySelector("[data-ref='ai-disclosure-select']"),
            boardSelect: root.querySelector("[data-ref='board-select']"),
            aiImageReshape: root.querySelector("[data-ref='ai-image-reshape']"),
            charCount: root.querySelector("[data-ref='char-count']"),
            submitButton: root.querySelector("[data-ref='submit-button']")
        };
        const fileInput = root.querySelector("[data-ref='image-input']");
        const submitButton = refs.submitButton;

        if (!hasBoundEvents) {
            attachComposerPanelEvents({ root, actions });
            root.addEventListener("click", (event) => {
                const removeButton = event.target.closest("[data-remove-image]");
                if (removeButton) {
                    actions.removeComposerImage(Number(removeButton.dataset.removeImage));
                    return;
                }

                if (event.target.closest("[data-composer-action='remove-audio']")) {
                    const audioDraft = store.getState().composerState.audioDraft;
                    if (audioDraft) {
                        revokeComposerAudioDraft(audioDraft);
                    }
                    store.dispatch({ type: "composer/clear-audio-draft" });
                    return;
                }

                if (event.target.closest("[data-composer-action='toggle-recording']")) {
                    void toggleRecording();
                    return;
                }

                if (event.target.closest("[data-ref='submit-button']")) {
                    void actions.submitPost();
                }
            });

            if (fileInput) {
                fileInput.addEventListener("change", () => {});
            }

            hasBoundEvents = true;
        }
    };

    return {
        render() {
            const vm = selectComposerPanelVM(store.getState());
            const shouldRerenderShell = !refs
                || root.innerHTML === ""
                || previousCanCompose !== vm.canCompose
                || previousExpanded !== vm.expanded
                || previousAnonymousMode !== vm.anonymousMode
                || previousStageSignature !== `${vm.stageInfo.value}:${vm.stageAllowsPosting ? 1 : 0}:${vm.anonymousLocked ? 1 : 0}`
                || previousClaimSignature !== `${vm.claimSelection?.postId || ""}:${vm.claimSelection?.authorName || ""}:${vm.claimSelection?.previewText || ""}`
                || previousMentionSignature !== `${vm.mentionOpen ? 1 : 0}:${vm.mentionTarget?.name || ""}:${vm.mentionTarget?.avatar || ""}`
                || previousAliasSignature !== `${vm.activeAlias?.key || ""}:${vm.activeAlias?.name || ""}:${vm.activeAlias?.avatar || ""}`
                || previousAudioSignature !== `${vm.audioRecording ? 1 : 0}:${vm.audioDraft?.id || ""}:${vm.audioDraft?.url || ""}`;

            if (shouldRerenderShell) {
                root.innerHTML = composerPanelTemplate(vm);
                ensureRefs();
                previousCanCompose = vm.canCompose;
                previousExpanded = vm.expanded;
                previousAnonymousMode = vm.anonymousMode;
                previousStageSignature = `${vm.stageInfo.value}:${vm.stageAllowsPosting ? 1 : 0}:${vm.anonymousLocked ? 1 : 0}`;
                previousClaimSignature = `${vm.claimSelection?.postId || ""}:${vm.claimSelection?.authorName || ""}:${vm.claimSelection?.previewText || ""}`;
                previousMentionSignature = `${vm.mentionOpen ? 1 : 0}:${vm.mentionTarget?.name || ""}:${vm.mentionTarget?.avatar || ""}`;
                previousAliasSignature = `${vm.activeAlias?.key || ""}:${vm.activeAlias?.name || ""}:${vm.activeAlias?.avatar || ""}`;
                previousAudioSignature = `${vm.audioRecording ? 1 : 0}:${vm.audioDraft?.id || ""}:${vm.audioDraft?.url || ""}`;
                if (!vm.canCompose) {
                    return;
                }
            }

            if (refs.identityAvatar) {
                refs.identityAvatar.src = vm.identityDisplay.avatar;
                refs.identityAvatar.alt = vm.identityDisplay.name;
            }
            if (refs.identityName) {
                refs.identityName.textContent = vm.identityDisplay.name;
            }
            if (refs.draftInput && document.activeElement !== refs.draftInput) {
                refs.draftInput.value = vm.draftText;
            }
            if (refs.draftInput) {
                refs.draftInput.placeholder = vm.placeholder;
                syncDraftInputHeight(refs.draftInput);
            }
            if (refs.boardSelect) {
                refs.boardSelect.value = vm.selectedBoard;
            }
            if (refs.anonymousTextRewrite) {
                refs.anonymousTextRewrite.checked = vm.anonymousTextRewrite;
            }
            if (refs.anonymousPreview) {
                refs.anonymousPreview.classList.toggle("is-hidden", !vm.showAnonymousTextPreview);
                refs.anonymousPreview.classList.toggle("is-loading", vm.anonymousPreviewStatus === "loading");
            }
            if (refs.anonymousPreviewBody) {
                refs.anonymousPreviewBody.textContent = vm.anonymousPreviewDisplayText;
            }
            const anonymousPreviewLabel = root.querySelector(".composer-panel__anonymous-preview-label");
            if (anonymousPreviewLabel) {
                anonymousPreviewLabel.textContent = vm.anonymousPreviewStatus === "loading" ? "AI 润色中" : "AI 润色预览";
            }
            if (refs.aiImageReshape) {
                refs.aiImageReshape.checked = vm.aiImageReshape;
            }
            if (refs.charCount) {
                refs.charCount.textContent = `${vm.charCount}/1000`;
            }
            if (refs.submitButton) {
                refs.submitButton.textContent = vm.submitLabel;
                refs.submitButton.disabled = !vm.canSubmit;
            }
            if (refs.imageList) {
                renderImages(refs.imageList, vm.images);
            }

            const anonymousToggle = root.querySelector("[data-composer-action='toggle-anonymous']");
            if (anonymousToggle) {
                anonymousToggle.classList.toggle("is-active", vm.anonymousMode);
            }
            if (refs.anonymousIcon) {
                refs.anonymousIcon.textContent = "alternate_email";
            }

            previousCanCompose = vm.canCompose;
            previousExpanded = vm.expanded;
            previousAnonymousMode = vm.anonymousMode;
            previousStageSignature = `${vm.stageInfo.value}:${vm.stageAllowsPosting ? 1 : 0}:${vm.anonymousLocked ? 1 : 0}`;
            previousClaimSignature = `${vm.claimSelection?.postId || ""}:${vm.claimSelection?.authorName || ""}:${vm.claimSelection?.previewText || ""}`;
            previousMentionSignature = `${vm.mentionOpen ? 1 : 0}:${vm.mentionTarget?.name || ""}:${vm.mentionTarget?.avatar || ""}`;
            previousAliasSignature = `${vm.activeAlias?.key || ""}:${vm.activeAlias?.name || ""}:${vm.activeAlias?.avatar || ""}`;
            previousAudioSignature = `${vm.audioRecording ? 1 : 0}:${vm.audioDraft?.id || ""}:${vm.audioDraft?.url || ""}`;
        }
    };
};
