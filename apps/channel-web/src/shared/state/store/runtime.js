import { defaultAnonymousProfiles, defaultRealIdentity } from "../../../entities/identity/config.js";
import { cloneSimple, firstAliasKey } from "./helpers.js";

export const resetMemberRuntime = (draft) => {
    draft.runtimeState.realIdentity = { ...defaultRealIdentity };
    draft.runtimeState.anonymousProfiles = defaultAnonymousProfiles.map((profile) => ({ ...profile }));
    draft.runtimeState.activeAliasKey = firstAliasKey;
    draft.roundState.claimSelection = null;
    draft.roundState.guessSelection = null;
    draft.roundState.guessExcludedNames = [];
    draft.roundState.revealMap = {};
    draft.roundState.memberStatuses = [];
    draft.roundState.archiveViewerRoundId = null;
    draft.roundState.archiveViewerDetail = null;
    draft.roundState.progress.claimSelected = false;
    draft.roundState.progress.guessSubmitted = false;
    draft.composerState.expanded = false;
    draft.composerState.anonymousMode = false;
    draft.composerState.anonymousTextRewrite = true;
    draft.composerState.anonymousPreviewStatus = "idle";
    draft.composerState.anonymousPreviewText = "";
    draft.composerState.anonymousPreviewSourceText = "";
    draft.composerState.aiImageReshape = true;
};

const resetRoundArchives = (draft) => {
    draft.roundState.archives = [];
    draft.roundState.archiveViewerRoundId = null;
    draft.roundState.archiveViewerDetail = null;
    draft.overlayState.channelIntelligence.selectedArchiveId = null;
};

export const applyRoundStateFromChannel = (draft, channel) => {
    const previousRoundId = draft.roundState.currentRoundId;
    const nextTheme = String(channel?.currentRoundTheme || channel?.current_round_theme || "").trim();
    const nextGodName = String(channel?.currentRoundGodProfile?.name || channel?.current_round_god_name || "").trim();
    const nextGodAvatar = String(channel?.currentRoundGodProfile?.avatar || channel?.current_round_god_avatar || "").trim();
    const nextStage = String(channel?.currentRoundStage || channel?.current_round_stage || "").trim() || "wish";
    const nextStatus = String(channel?.currentRoundStatus || channel?.current_round_status || "").trim() || "active";
    const nextRoundId = channel?.currentRoundId || channel?.current_round_id || null;
    const nextDeadlines = channel?.currentRoundDeadlines && typeof channel.currentRoundDeadlines === "object"
        ? channel.currentRoundDeadlines
        : channel?.current_round_deadlines && typeof channel.current_round_deadlines === "object"
            ? channel.current_round_deadlines
            : {};
    const nextStartedAt = channel?.currentRoundStartedAt || channel?.current_round_started_at || null;
    const nextCompletedAt = channel?.currentRoundCompletedAt || channel?.current_round_completed_at || null;
    const nextRevealMap = channel?.currentRevealMap && typeof channel.currentRevealMap === "object"
        ? channel.currentRevealMap
        : channel?.current_reveal_map && typeof channel.current_reveal_map === "object"
            ? channel.current_reveal_map
            : {};

    draft.roundState.currentRoundId = nextRoundId;
    draft.roundState.theme = nextTheme;
    draft.roundState.activeStage = nextStage;
    draft.roundState.status = nextStatus;
    draft.roundState.lifecycleStatus = nextStatus === "archived" ? "archived" : "active";
    draft.roundState.deadlines = { ...nextDeadlines };
    draft.roundState.startedAt = nextStartedAt;
    draft.roundState.completedAt = nextCompletedAt;
    draft.roundState.godProfile = nextGodName
        ? {
            name: nextGodName,
            avatar: nextGodAvatar
        }
        : null;
    draft.roundState.revealMap = { ...nextRevealMap };
    if (previousRoundId && nextRoundId && previousRoundId !== nextRoundId) {
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
    draft.overlayState.roundManagement.draftTheme = nextTheme;
    draft.overlayState.roundManagement.draftDeadlines = { ...nextDeadlines };
    draft.composerState.board = nextStage;
};

export const applyRuntimeActions = (draft, action) => {
    switch (action.type) {
    case "runtime/initialize-start":
        draft.runtimeState.phase = "hydrating";
        draft.runtimeState.blockingError = null;
        return true;
    case "runtime/shell-ready":
        draft.runtimeState.status = "preview";
        draft.runtimeState.phase = "shell";
        draft.runtimeState.hydrationSource = action.payload.source || "runtime-config";
        draft.runtimeState.blockingError = null;
        draft.runtimeState.channel = cloneSimple(action.payload.channel);
        applyRoundStateFromChannel(draft, action.payload.channel);
        resetMemberRuntime(draft);
        resetRoundArchives(draft);
        return true;
    case "runtime/hydrate-start":
        draft.runtimeState.phase = "hydrating";
        draft.runtimeState.blockingError = null;
        return true;
    case "runtime/preview-ready":
        draft.runtimeState.status = "preview";
        draft.runtimeState.phase = action.payload.phase || "ready";
        draft.runtimeState.hydrationSource = action.payload.source || draft.runtimeState.hydrationSource;
        draft.runtimeState.blockingError = null;
        draft.runtimeState.channel = cloneSimple(action.payload.channel);
        applyRoundStateFromChannel(draft, action.payload.channel);
        resetMemberRuntime(draft);
        resetRoundArchives(draft);
        return true;
    case "runtime/member-ready":
        draft.runtimeState.status = "ready";
        draft.runtimeState.phase = action.payload.phase || "ready";
        draft.runtimeState.hydrationSource = action.payload.source || draft.runtimeState.hydrationSource;
        draft.runtimeState.blockingError = null;
        draft.runtimeState.channel = cloneSimple(action.payload.channel);
        applyRoundStateFromChannel(draft, action.payload.channel);
        resetRoundArchives(draft);
        draft.runtimeState.realIdentity = { ...action.payload.realIdentity };
        draft.runtimeState.anonymousProfiles = action.payload.anonymousProfiles.map((profile) => ({ ...profile }));
        draft.runtimeState.activeAliasKey = action.payload.activeAliasKey
            || action.payload.anonymousProfiles[0]?.key
            || firstAliasKey;
        draft.roundState.claimSelection = cloneSimple(action.payload.claimSelection) || null;
        draft.roundState.guessSelection = cloneSimple(action.payload.guessSelection) || null;
        draft.roundState.guessExcludedNames = [];
        draft.roundState.progress.claimSelected = Boolean(action.payload.claimSelection?.postId);
        draft.roundState.progress.guessSubmitted = Boolean(action.payload.guessSelection?.name);
        draft.overlayState.identity.draftName = action.payload.realIdentity.name;
        draft.overlayState.identity.draftAvatar = action.payload.realIdentity.avatar;
        draft.overlayState.identity.sourceName = action.payload.realIdentity.name;
        draft.overlayState.identity.sourceAvatar = action.payload.realIdentity.avatar;
        return true;
    case "runtime/initialize-error":
        draft.runtimeState.phase = "error";
        draft.runtimeState.blockingError = action.payload.error;
        return true;
    case "runtime/set-alias-key":
        draft.runtimeState.activeAliasKey = action.payload.key;
        return true;
    case "runtime/set-alias-profiles":
        draft.runtimeState.anonymousProfiles = action.payload.profiles.map((profile) => ({ ...profile }));
        if (!draft.runtimeState.anonymousProfiles.some((profile) => profile.key === draft.runtimeState.activeAliasKey)) {
            draft.runtimeState.activeAliasKey = draft.runtimeState.anonymousProfiles[0]?.key || null;
        }
        return true;
    case "runtime/update-identity":
        draft.runtimeState.realIdentity = { ...draft.runtimeState.realIdentity, ...action.payload.identity };
        draft.overlayState.identity.draftName = draft.runtimeState.realIdentity.name;
        draft.overlayState.identity.draftAvatar = draft.runtimeState.realIdentity.avatar;
        draft.overlayState.identity.sourceName = draft.runtimeState.realIdentity.name;
        draft.overlayState.identity.sourceAvatar = draft.runtimeState.realIdentity.avatar;
        return true;
    case "runtime/update-channel":
        draft.runtimeState.channel = {
            ...draft.runtimeState.channel,
            ...action.payload.channel
        };
        applyRoundStateFromChannel(draft, draft.runtimeState.channel);
        draft.overlayState.channelSettings.draftName = draft.runtimeState.channel?.name || "";
        draft.overlayState.channelSettings.draftLogo = draft.runtimeState.channel?.logoUrl || "";
        draft.overlayState.channelSettings.draftBackground = draft.runtimeState.channel?.backgroundUrl || "";
        return true;
    default:
        return false;
    }
};
