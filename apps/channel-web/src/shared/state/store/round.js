export const applyRoundActions = (draft, action) => {
    switch (action.type) {
    case "round/set-current-round": {
        const previousRoundId = draft.roundState.currentRoundId;
        const nextRoundId = action.payload.round?.id || null;
        const isDifferentRound = Boolean(previousRoundId && nextRoundId && previousRoundId !== nextRoundId);

        draft.roundState.currentRoundId = nextRoundId;
        draft.roundState.lifecycleStatus = action.payload.round?.lifecycleStatus || "active";
        draft.roundState.archiveMode = action.payload.round?.archiveMode || null;
        draft.roundState.defaultTitle = action.payload.round?.defaultTitle || "";
        draft.roundState.theme = action.payload.round?.theme || "";
        draft.roundState.activeStage = action.payload.round?.currentStage || "wish";
        draft.roundState.status = action.payload.round?.lifecycleStatus === "archived" ? "archived" : "active";
        draft.roundState.deadlines = { ...(action.payload.round?.deadlines || {}) };
        draft.roundState.startedAt = action.payload.round?.startedAt || null;
        draft.roundState.completedAt = action.payload.round?.completedAt || null;
        draft.roundState.forceArchiveReason = action.payload.round?.forceArchiveReason || "";
        draft.roundState.completionSnapshot = action.payload.round?.completionSnapshot ? { ...action.payload.round.completionSnapshot } : {};
        draft.roundState.sourceRoundId = action.payload.round?.sourceRoundId || null;
        draft.roundState.viewOnlyReason = action.payload.round?.viewOnlyReason || null;
        draft.roundState.godProfile = action.payload.round?.godProfile ? { ...action.payload.round.godProfile } : null;
        draft.roundState.revealMap = action.payload.round?.revealMap ? { ...action.payload.round.revealMap } : {};
        if (isDifferentRound) {
            draft.roundState.claimSelection = null;
            draft.roundState.guessSelection = null;
            draft.roundState.guessExcludedNames = [];
            draft.roundState.memberStatuses = [];
            draft.roundState.progress = {
                wishSubmitted: false,
                claimSelected: false,
                deliverySubmitted: false,
                guessSubmitted: false
            };
            draft.composerState.mentionTarget = null;
            draft.composerState.mentionOpen = false;
        }
        return true;
    }
    case "round/set-stage":
        draft.roundState.activeStage = action.payload.stage;
        draft.composerState.board = action.payload.stage;
        draft.composerState.mentionTarget = action.payload.stage === "delivery" && draft.roundState.claimSelection
            ? {
                name: draft.roundState.claimSelection.authorName,
                avatar: draft.roundState.claimSelection.authorAvatar || ""
            }
            : action.payload.stage === "guess" && draft.roundState.guessSelection
                ? {
                    name: draft.roundState.guessSelection.name,
                    avatar: draft.roundState.guessSelection.avatar || ""
                }
                : null;
        draft.composerState.mentionOpen = false;
        if (action.payload.forceAnonymous) {
            draft.composerState.anonymousMode = true;
            draft.composerState.aiDisclosure = "none";
            draft.composerState.aiDisclosureOpen = false;
            draft.composerState.aiImageReshape = true;
        }
        return true;
    case "round/set-claim-selection":
        draft.roundState.claimSelection = action.payload.selection ? { ...action.payload.selection } : null;
        draft.roundState.progress.claimSelected = Boolean(action.payload.selection?.postId);
        if (draft.roundState.activeStage === "delivery") {
            draft.composerState.mentionTarget = action.payload.selection
                ? {
                    name: action.payload.selection.authorName,
                    avatar: action.payload.selection.authorAvatar || ""
                }
                : null;
        }
        return true;
    case "round/set-guess-selection":
        draft.roundState.guessSelection = action.payload.selection ? { ...action.payload.selection } : null;
        draft.roundState.progress.guessSubmitted = Boolean(action.payload.selection?.name);
        if (action.payload.selection?.name) {
            draft.roundState.guessExcludedNames = draft.roundState.guessExcludedNames.filter((name) => name !== action.payload.selection.name);
        }
        if (draft.roundState.activeStage === "guess") {
            draft.composerState.mentionTarget = action.payload.selection
                ? {
                    name: action.payload.selection.name,
                    avatar: action.payload.selection.avatar || ""
                }
                : null;
        }
        return true;
    case "round/toggle-guess-exclusion": {
        const name = String(action.payload.name || "").trim();
        if (!name) {
            return true;
        }
        if (draft.roundState.guessExcludedNames.includes(name)) {
            draft.roundState.guessExcludedNames = draft.roundState.guessExcludedNames.filter((item) => item !== name);
            return true;
        }
        draft.roundState.guessExcludedNames = [...draft.roundState.guessExcludedNames, name];
        if (draft.roundState.guessSelection?.name === name) {
            draft.roundState.guessSelection = null;
            draft.roundState.progress.guessSubmitted = false;
        }
        if (draft.composerState.mentionTarget?.name === name) {
            draft.composerState.mentionTarget = null;
        }
        return true;
    }
    case "round/set-theme":
        draft.roundState.theme = action.payload.theme;
        draft.overlayState.roundManagement.draftTheme = action.payload.theme;
        return true;
    case "round/set-member-statuses":
        draft.roundState.memberStatuses = (action.payload.items || []).map((item) => ({ ...item }));
        return true;
    case "round/reset-transient-progress":
        draft.roundState.claimSelection = null;
        draft.roundState.guessSelection = null;
        draft.roundState.guessExcludedNames = [];
        draft.roundState.memberStatuses = [];
        draft.roundState.progress = {
            wishSubmitted: false,
            claimSelected: false,
            deliverySubmitted: false,
            guessSubmitted: false
        };
        draft.composerState.mentionTarget = null;
        draft.composerState.mentionOpen = false;
        return true;
    case "round/set-archives":
        draft.roundState.archives = (action.payload.items || []).map((archive) => ({
            ...archive,
            godProfile: archive.godProfile ? { ...archive.godProfile } : null,
            savedBy: archive.savedBy ? { ...archive.savedBy } : null,
            deadlines: archive.deadlines ? { ...archive.deadlines } : {},
            stats: archive.stats ? { ...archive.stats } : null,
            completionSnapshot: archive.completionSnapshot ? { ...archive.completionSnapshot } : {},
            revealPairs: (archive.revealPairs || []).map((pair) => ({
                ...pair,
                member: pair.member ? { ...pair.member } : null,
                angel: pair.angel ? { ...pair.angel } : null
            }))
        }));
        return true;
    case "round/set-archive-viewer":
        draft.roundState.archiveViewerRoundId = action.payload.roundId || null;
        draft.roundState.archiveViewerDetail = action.payload.detail
            ? {
                ...action.payload.detail,
                godProfile: action.payload.detail.godProfile ? { ...action.payload.detail.godProfile } : null,
                deadlines: action.payload.detail.deadlines ? { ...action.payload.detail.deadlines } : {},
                completionSnapshot: action.payload.detail.completionSnapshot ? { ...action.payload.detail.completionSnapshot } : {},
                revealMap: action.payload.detail.revealMap ? { ...action.payload.detail.revealMap } : {},
                members: (action.payload.detail.members || []).map((member) => ({ ...member })),
                posts: (action.payload.detail.posts || []).map((post) => ({
                    ...post,
                    images: [...(post.images || [])],
                    audioClips: [...(post.audioClips || [])],
                    comments: (post.comments || []).map((comment) => ({ ...comment }))
                })),
                revealPairs: (action.payload.detail.revealPairs || []).map((pair) => ({
                    ...pair,
                    member: pair.member ? { ...pair.member } : null,
                    angel: pair.angel ? { ...pair.angel } : null
                }))
            }
            : null;
        return true;
    case "round/set-god":
        draft.roundState.godProfile = action.payload.godProfile ? { ...action.payload.godProfile } : null;
        draft.overlayState.roundManagement.godPickerOpen = false;
        return true;
    case "round/mark-progress":
        draft.roundState.progress = {
            ...draft.roundState.progress,
            ...action.payload
        };
        return true;
    default:
        return false;
    }
};
