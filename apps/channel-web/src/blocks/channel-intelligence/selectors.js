import { defaultRoundDeadlines, gameBoardStages } from "../../entities/channel/config.js";
import { isEntryOwnedByIdentity } from "../../shared/lib/anonymous-display.js";
import { buildChannelMemberOptions, buildRoundDisplayTitle, buildRoundPrimaryLabel } from "../../features/round/model.js";

const stageByValue = new Map(gameBoardStages.map((stage) => [stage.value, stage]));

const buildRevealPairs = (revealMap) => Object.values(revealMap || {})
    .filter((entry) => entry?.member?.name && entry?.angel?.name)
    .sort((left, right) => left.member.name.localeCompare(right.member.name, "zh-Hans-CN"));

const hasAuthoredBoardPost = (state, boardValue) => {
    const currentIdentity = {
        id: state.runtimeState.realIdentity.id,
        name: state.runtimeState.realIdentity.name,
        userId: state.authState.user?.id || null
    };
    if (!currentIdentity.id && !currentIdentity.name && !currentIdentity.userId) {
        return false;
    }

    return (state.feedState.items || []).some((post) => (
        !post?.isDeleted
        && post.board === boardValue
        && isEntryOwnedByIdentity(post, currentIdentity)
    ));
};

const buildTaskProgressByStage = ({ progress, currentGuess, revealMap, memberName, state }) => ({
    wish: progress.wishSubmitted || hasAuthoredBoardPost(state, "wish"),
    claim: progress.claimSelected,
    delivery: progress.deliverySubmitted || hasAuthoredBoardPost(state, "delivery"),
    guess: progress.guessSubmitted || Boolean(currentGuess?.name),
    reveal: Boolean(revealMap?.[memberName])
});

const getTaskStatus = (stageValue, isDone, canCompose) => {
    if (isDone) {
        return "已完成";
    }

    if (stageValue === "claim") {
        return "待完成";
    }

    if (stageValue === "reveal") {
        return "待揭晓";
    }

    return canCompose ? "待完成" : "待开放";
};

const formatArchiveDate = (value) => {
    const timestamp = Date.parse(value || "");
    if (!Number.isFinite(timestamp)) {
        return "未记录时间";
    }

    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
};

const buildArchiveMetaLine = (archive) => {
    const pairCount = Number(archive?.stats?.pairCount || archive?.revealPairs?.length || 0);
    const godName = String(archive?.godProfile?.name || "").trim();
    const completedDate = formatArchiveDate(archive?.completedAt || archive?.createdAt);
    return [completedDate, godName ? `上帝 ${godName}` : "", `${pairCount} 对揭晓`]
        .filter(Boolean)
        .join(" · ");
};

const getDeadlineLabel = (deadline, fallback = "") => (
    deadline && typeof deadline === "object"
        ? String(deadline.label || fallback || "").trim()
        : String(deadline || fallback || "").trim()
);

const parseDeadline = (value) => {
    const timestamp = Date.parse(value || "");
    return Number.isFinite(timestamp) ? timestamp : 0;
};

const formatAbsoluteDeadline = (value) => {
    const timestamp = parseDeadline(value);
    if (!timestamp) {
        return "还没设置";
    }

    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}.${month}.${day} ${hours}:${minutes}`;
};

const formatRelativeDeadline = (value) => {
    const timestamp = parseDeadline(value);
    if (!timestamp) {
        return "设置后系统会自动锁定本轮参与名单。";
    }

    const diffMs = timestamp - Date.now();
    const absMinutes = Math.max(1, Math.round(Math.abs(diffMs) / (60 * 1000)));
    if (absMinutes < 60) {
        return diffMs >= 0 ? `还剩 ${absMinutes} 分钟` : `已超时 ${absMinutes} 分钟`;
    }

    const absHours = Math.max(1, Math.round(absMinutes / 60));
    if (absHours < 48) {
        return diffMs >= 0 ? `还剩 ${absHours} 小时` : `已超时 ${absHours} 小时`;
    }

    const absDays = Math.max(1, Math.round(absHours / 24));
    return diffMs >= 0 ? `还剩 ${absDays} 天` : `已超时 ${absDays} 天`;
};

const toDateTimeLocalValue = (value) => {
    const timestamp = parseDeadline(value);
    if (!timestamp) {
        return "";
    }

    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const viewOnlyReasonLabels = {
    legacy_deadline_unknown: "旧摘要归档，只有结果摘要，不能恢复。",
    legacy_summary: "旧摘要归档，只有结果摘要，不能恢复。",
    missing_participants: "有参与成员已经不在当前频道，所以这个归档只能查看不能恢复。",
    missing_deadline: "这个归档缺少绝对截止时间，所以只能查看不能恢复。",
    deadline_passed: "这个归档后续阶段的截止时间已经过期，所以只能查看不能恢复。",
    not_archived: "当前不是一个可恢复的归档。"
};

export const selectChannelIntelligenceVM = (state) => {
    const currentStage = stageByValue.get(state.roundState.activeStage) || gameBoardStages[0];
    const progress = state.roundState.progress || {};
    const godProfile = state.roundState.godProfile;
    const currentTheme = String(state.roundState.theme || "").trim();
    const role = state.runtimeState.realIdentity.role;
    const canManageRound = ["owner", "admin"].includes(role);
    const isArchivedCurrentRound = state.roundState.lifecycleStatus === "archived";
    const canEditTheme = !isArchivedCurrentRound && (canManageRound || state.runtimeState.realIdentity.name === godProfile?.name);
    const godOptions = buildChannelMemberOptions(state);
    const revealPairs = buildRevealPairs(state.roundState.revealMap);
    const revealEntry = state.roundState.revealMap?.[state.runtimeState.realIdentity.name] || null;
    const currentGuess = state.roundState.guessSelection;
    const taskStage = stageByValue.get(state.feedState.activeBoard) || currentStage;
    const rawArchives = state.roundState.archives || [];
    const selectedArchiveId = state.overlayState.channelIntelligence.selectedArchiveId;
    const effectiveSelectedArchiveId = rawArchives.some((archive) => archive.id === selectedArchiveId)
        ? selectedArchiveId
        : null;
    const archives = rawArchives.map((archive) => ({
        ...archive,
        displayTitle: buildRoundPrimaryLabel({
            title: archive.title,
            defaultTitle: archive.defaultTitle,
            theme: archive.theme,
            completedAt: archive.completedAt,
            createdAt: archive.createdAt
        }),
        completedDateLabel: formatArchiveDate(archive.completedAt || archive.createdAt),
        metaLine: buildArchiveMetaLine(archive),
        isSelected: archive.id === effectiveSelectedArchiveId
    }));
    const selectedArchive = archives.find((archive) => archive.id === effectiveSelectedArchiveId) || null;
    const archiveViewerDetail = state.roundState.archiveViewerDetail || null;
    const selectedArchiveDetail = archiveViewerDetail?.id === effectiveSelectedArchiveId ? archiveViewerDetail : null;
    const archiveDialogArchive = selectedArchive
        ? {
            ...selectedArchive,
            ...(selectedArchiveDetail || {}),
            displayTitle: buildRoundPrimaryLabel({
                title: selectedArchiveDetail?.title ?? selectedArchive.title,
                defaultTitle: selectedArchiveDetail?.defaultTitle ?? selectedArchive.defaultTitle,
                theme: selectedArchiveDetail?.theme ?? selectedArchive.theme,
                completedAt: selectedArchiveDetail?.completedAt ?? selectedArchive.completedAt,
                createdAt: selectedArchiveDetail?.createdAt ?? selectedArchive.createdAt
            }),
            metaLine: buildArchiveMetaLine(selectedArchiveDetail || selectedArchive),
            isRestorable: selectedArchive.isRestorable,
            viewOnlyReason: selectedArchive.viewOnlyReason,
            archiveMode: selectedArchiveDetail?.archiveMode || selectedArchive.archiveMode,
            stats: selectedArchiveDetail?.stats || selectedArchive.stats,
            revealPairs: selectedArchiveDetail?.revealPairs || selectedArchive.revealPairs || []
        }
        : null;
    const taskProgressByStage = buildTaskProgressByStage({
        progress,
        currentGuess,
        revealMap: state.roundState.revealMap || {},
        memberName: state.runtimeState.realIdentity.name,
        state
    });
    const currentTaskDone = taskProgressByStage[taskStage.value];
    const deadlines = state.roundState.deadlines || {};
    const wishDeadline = deadlines.wish || null;
    const wishDeadlineDraft = state.overlayState.roundManagement.draftDeadlines?.wish?.deadlineAt || wishDeadline?.deadlineAt || null;
    const currentRoundDisplayTitle = buildRoundDisplayTitle({
        title: state.roundState.title,
        defaultTitle: state.roundState.defaultTitle,
        theme: state.roundState.theme,
        startedAt: state.roundState.startedAt
    });

    return {
        currentRoundDisplayTitle,
        godPickerOpen: state.overlayState.roundManagement.godPickerOpen,
        themeEditorOpen: state.overlayState.roundManagement.themeEditorOpen,
        revealEditorOpen: state.overlayState.roundManagement.revealEditorOpen,
        revealMemberPickerOpen: state.overlayState.roundManagement.revealMemberPickerOpen,
        revealAngelPickerOpen: state.overlayState.roundManagement.revealAngelPickerOpen,
        draftRevealMember: state.overlayState.roundManagement.draftRevealMember,
        draftRevealAngel: state.overlayState.roundManagement.draftRevealAngel,
        draftTheme: state.overlayState.roundManagement.draftTheme || currentTheme,
        godProfile,
        godOptions,
        revealMemberOptions: godOptions,
        revealAngelOptions: godOptions,
        revealPairs,
        showRevealSummary: currentStage.value === "reveal",
        revealResult: revealEntry?.angel
            ? {
                guessedName: currentGuess?.name || revealEntry.guessedAngelName || "",
                actualName: revealEntry.angel.name,
                actualAvatar: revealEntry.angel.avatar || "",
                isCorrect: Boolean(currentGuess?.name || revealEntry.guessedAngelName)
                    && (currentGuess?.name || revealEntry.guessedAngelName) === revealEntry.angel.name
            }
            : null,
        currentTheme: currentTheme || "待本周上帝发布主题",
        hasTheme: Boolean(currentTheme),
        canManageRound,
        canRenameCurrentRound: canManageRound && !isArchivedCurrentRound,
        canEditTheme,
        canArchiveRound: canManageRound && !isArchivedCurrentRound && currentStage.value === "reveal",
        canForceArchiveRound: canManageRound && !isArchivedCurrentRound,
        currentStageLabel: currentStage.label,
        wishDeadlineDisplay: formatAbsoluteDeadline(wishDeadline?.deadlineAt || null),
        wishDeadlineRelativeLabel: formatRelativeDeadline(wishDeadline?.deadlineAt || null),
        wishDeadlineEditorOpen: state.overlayState.roundManagement.deadlineEditorOpen,
        wishDeadlineDraftValue: toDateTimeLocalValue(wishDeadlineDraft),
        wishDeadlineButtonLabel: wishDeadline?.deadlineAt ? "修改截止" : "设置截止",
        currentTaskLabel: taskStage.taskLabel,
        currentTaskStageLabel: taskStage.label,
        currentDeadlineLabel: getDeadlineLabel(deadlines[currentStage.value], currentStage.deadlineLabel),
        currentTaskStatus: getTaskStatus(taskStage.value, currentTaskDone, taskStage.canCompose),
        currentTaskHint: taskStage.value === "reveal"
            ? (
                revealEntry?.angel
                    ? `你猜的是 ${currentGuess?.name || revealEntry.guessedAngelName || "未提交猜测"}，实际天使是 ${revealEntry.angel.name}。`
                    : "管理员一键生成揭晓结果后，这里会直接显示你的结果。"
            )
            : taskStage.canCompose
                ? taskStage.helperText
                : "这个阶段先不发帖，等后续对应能力补上。",
        archives,
        selectedArchive,
        archiveDialogArchive,
        archiveDetailOpen: Boolean(state.overlayState.channelIntelligence.archiveDetailOpen && selectedArchive),
        archiveViewerDetail,
        archiveViewerRoundId: state.roundState.archiveViewerRoundId,
        archiveViewerActive: Boolean(state.roundState.archiveViewerRoundId),
        selectedArchiveViewOnlyLabel: selectedArchive?.viewOnlyReason ? (viewOnlyReasonLabels[selectedArchive.viewOnlyReason] || "当前归档只能查看，不能恢复。") : "",
        currentRoundArchived: isArchivedCurrentRound
    };
};
