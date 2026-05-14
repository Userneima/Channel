export const applyComposerActions = (draft, action) => {
    switch (action.type) {
    case "composer/set-field":
        Object.assign(draft.composerState, action.payload);
        return true;
    case "composer/expand":
        draft.composerState.expanded = true;
        return true;
    case "composer/collapse":
        draft.composerState.expanded = false;
        draft.composerState.aiDisclosureOpen = false;
        draft.composerState.mentionOpen = false;
        draft.composerState.proxyWishOpen = false;
        draft.composerState.emojiOpen = false;
        return true;
    case "composer/add-images":
        draft.composerState.images.push(...action.payload.images.map((image) => ({ ...image })));
        draft.composerState.nextImageId = action.payload.nextImageId;
        draft.composerState.expanded = true;
        return true;
    case "composer/set-audio-draft":
        draft.composerState.audioDraft = action.payload.audio ? { ...action.payload.audio } : null;
        draft.composerState.nextAudioId = action.payload.nextAudioId ?? draft.composerState.nextAudioId;
        draft.composerState.expanded = true;
        return true;
    case "composer/clear-audio-draft":
        draft.composerState.audioDraft = null;
        return true;
    case "composer/set-recording":
        draft.composerState.audioRecording = Boolean(action.payload.recording);
        if (action.payload.expand) {
            draft.composerState.expanded = true;
        }
        return true;
    case "composer/remove-image":
        draft.composerState.images = draft.composerState.images.filter((image) => image.id !== action.payload.id);
        return true;
    case "composer/reset":
        draft.composerState.expanded = false;
        draft.composerState.draftText = "";
        draft.composerState.images = [];
        draft.composerState.audioDraft = null;
        draft.composerState.audioRecording = false;
        draft.composerState.mentionTarget = null;
        draft.composerState.proxyWishTarget = null;
        draft.composerState.aiDisclosure = "none";
        draft.composerState.board = "none";
        draft.composerState.anonymousTextRewrite = true;
        draft.composerState.anonymousPreviewStatus = "idle";
        draft.composerState.anonymousPreviewText = "";
        draft.composerState.anonymousPreviewSourceText = "";
        draft.composerState.aiImageReshape = true;
        draft.composerState.submitStatus = "idle";
        draft.composerState.error = null;
        draft.composerState.mentionOpen = false;
        draft.composerState.proxyWishOpen = false;
        draft.composerState.emojiOpen = false;
        draft.composerState.aiDisclosureOpen = false;
        draft.composerState.boardOpen = false;
        draft.composerState.selectionStart = 0;
        draft.composerState.selectionEnd = 0;
        return true;
    case "composer/toggle-anonymous":
        draft.composerState.anonymousMode = !draft.composerState.anonymousMode;
        if (draft.composerState.anonymousMode) {
            draft.composerState.aiDisclosure = "none";
            draft.composerState.aiDisclosureOpen = false;
            draft.composerState.anonymousTextRewrite = true;
            draft.composerState.aiImageReshape = true;
        } else {
            draft.composerState.anonymousTextRewrite = false;
            draft.composerState.anonymousPreviewStatus = "idle";
            draft.composerState.anonymousPreviewText = "";
            draft.composerState.anonymousPreviewSourceText = "";
            draft.composerState.aiImageReshape = false;
        }
        return true;
    case "composer/submit-start":
        draft.composerState.submitStatus = "submitting";
        draft.composerState.error = null;
        return true;
    case "composer/submit-error":
        draft.composerState.submitStatus = "idle";
        draft.composerState.error = action.payload.error;
        return true;
    default:
        return false;
    }
};
