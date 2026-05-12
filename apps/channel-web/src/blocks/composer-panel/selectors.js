import { channelBoardChoices, channelShellConfig, gameBoardStages } from "../../entities/channel/config.js";
import { composerIdentityPresets } from "../../entities/identity/config.js";
import { composerCapabilityRegistry } from "../../features/composer/registry.js";
import { buildChannelMemberOptions, buildRevealPairs, buildRevealResult, getRoundStage } from "../../features/round/model.js";
import { anonymizeComposerText } from "../../shared/lib/helpers.js";

const aiDisclosureChoices = [
    {
        value: "none",
        label: "不声明"
    },
    {
        value: "ai-generated",
        label: "包含 AI 生成内容"
    }
];

const freeChatStage = {
    value: "all",
    label: "闲聊",
    taskLabel: "匿名或实名随意聊聊",
    deadlineLabel: "",
    canCompose: true,
    forceAnonymous: false,
    requiresMention: false,
    submitLabel: "发布闲聊",
    placeholder: "匿名或实名都可以，随便聊聊当前想法...",
    helperText: "这里是独立的闲聊板块，不会把内容发到后方回合板块里。"
};

export const selectComposerPanelVM = (state) => {
    const currentChannel = state.runtimeState.channel;
    const archiveViewer = state.roundState.archiveViewerRoundId ? state.roundState.archiveViewerDetail : null;
    const activeBoard = state.feedState.activeBoard;
    const isFreeChatBoard = activeBoard === "all";
    const stage = isFreeChatBoard
        ? freeChatStage
        : (getRoundStage(archiveViewer?.currentStage || state.roundState.activeStage) || gameBoardStages[0]);
    const isGuessBoard = activeBoard === "guess" || (!isFreeChatBoard && stage.value === "guess");
    const activeAlias = state.runtimeState.anonymousProfiles.find((profile) => profile.key === state.runtimeState.activeAliasKey)
        || state.runtimeState.anonymousProfiles[0];
    const claimSelection = state.roundState.claimSelection;
    const guessSelection = state.roundState.guessSelection;
    const canChooseMentionTarget = stage.value === "guess";
    const effectiveMentionTarget = stage.requiresMention
        ? (
            (stage.value === "guess" && state.composerState.mentionTarget)
            || (stage.value === "delivery" && claimSelection
                ? {
                    name: claimSelection.authorName,
                    avatar: claimSelection.authorAvatar || ""
                }
                : null)
            || (stage.value === "guess" && guessSelection
                ? {
                    name: guessSelection.name,
                    avatar: guessSelection.avatar || ""
                }
                : null)
        )
        : null;
    const anonymousMode = stage.forceAnonymous ? true : state.composerState.anonymousMode;
    const expanded = state.composerState.expanded;
    const draftText = state.composerState.draftText;
    const images = state.composerState.images;
    const audioDraft = state.composerState.audioDraft;
    const audioRecording = state.composerState.audioRecording;
    const authStatus = state.authState.status;
    const membershipStatus = state.membershipState.status;
    const isReadOnlyRound = Boolean(state.roundState.archiveViewerRoundId) || state.roundState.lifecycleStatus === "archived";
    const canCompose = !isReadOnlyRound && membershipStatus === "approved" && authStatus === "authenticated";
    const guestIdentityDisplay = {
        avatar: currentChannel?.logoUrl || channelShellConfig.channelLogo,
        name: "未登录",
        meta: "公开浏览模式"
    };
    const gateByState = authStatus === "guest"
        ? {
            accessMode: "guest",
            title: "登录后才能发帖",
            description: "注册或登录后会自动加入当前频道，可直接发帖、评论和使用匿名马甲。",
            placeholder: "登录后即可参与频道，当前无法发内容",
            primaryLabel: "邮箱登录",
            primaryAction: "open-auth-login"
        }
        : authStatus === "upgrading_legacy_anonymous"
            ? {
                accessMode: "upgrade",
                title: "完成账号升级后继续",
                description: "升级成正式账号后，你会直接回到当前频道继续参与。",
                placeholder: "完成账号升级后即可发内容",
                primaryLabel: "继续升级",
                primaryAction: "open-auth-upgrade"
            }
            : {
                accessMode: "syncing",
                title: "正在进入频道",
                description: "成员身份正在同步，通常刷新后就会恢复可编辑状态。",
                placeholder: "正在同步频道身份，暂时无法发内容",
                primaryLabel: "",
                primaryAction: ""
            };
    const readOnlyGate = {
        accessMode: "readonly",
        title: state.roundState.archiveViewerRoundId ? "当前是历史归档" : "当前回合已经归档",
        description: state.roundState.archiveViewerRoundId
            ? "你正在查看历史回放，这里只读不写。"
            : "本轮已经归档完成，如需继续运行请先恢复某个存档。",
        placeholder: state.roundState.archiveViewerRoundId ? "历史归档只读查看" : "当前回合已归档，暂不接受新内容",
        primaryLabel: "",
        primaryAction: ""
    };
    const availableMentionMembers = stage.value === "guess"
        ? buildChannelMemberOptions(state, {
            excludeCurrent: true,
            onlyWishParticipants: true
        })
        : buildChannelMemberOptions(state);
    const revealPairs = buildRevealPairs(state.roundState.revealMap);
    const revealResult = buildRevealResult({
        revealMap: state.roundState.revealMap,
        memberName: state.runtimeState.realIdentity.name,
        guessSelection
    });
    const anonymousPreviewSourceMatches = state.composerState.anonymousPreviewSourceText === draftText.trim();
    const anonymousPreviewDisplayText = anonymousPreviewSourceMatches && state.composerState.anonymousPreviewText
        ? state.composerState.anonymousPreviewText
        : anonymizeComposerText(draftText.trim());

    return {
        capabilities: composerCapabilityRegistry,
        canCompose,
        stageAllowsPosting: stage.canCompose,
        hideInlineComposer: isGuessBoard,
        stageInfo: stage,
        expanded,
        gate: canCompose ? null : (isReadOnlyRound ? readOnlyGate : gateByState),
        draftText,
        images,
        audioDraft,
        audioRecording,
        mentionTarget: effectiveMentionTarget,
        mentionOpen: stage.requiresMention && canChooseMentionTarget ? state.composerState.mentionOpen : false,
        mentionMembers: availableMentionMembers,
        canChooseMentionTarget,
        mentionTitle: stage.value === "guess" ? "你猜的是谁" : "实现谁的愿望",
        charCount: draftText.length,
        aiDisclosure: state.composerState.aiDisclosure,
        aiDisclosureChoices,
        boardChoices: channelBoardChoices,
        selectedBoard: stage.value,
        anonymousMode,
        anonymousLocked: stage.forceAnonymous,
        anonymousTextRewrite: state.composerState.anonymousTextRewrite,
        anonymousPreviewStatus: state.composerState.anonymousPreviewStatus,
        anonymousPreviewDisplayText,
        showAnonymousTextPreview: anonymousMode && state.composerState.anonymousTextRewrite && Boolean(draftText.trim()),
        aiImageReshape: state.composerState.aiImageReshape,
        aiDisclosureOpen: stage.forceAnonymous ? false : state.composerState.aiDisclosureOpen,
        submitStatus: state.composerState.submitStatus,
        submitLabel: state.composerState.submitStatus === "submitting"
            ? "提交中"
            : stage.submitLabel,
        canSubmit: stage.canCompose
            && Boolean(draftText.trim() || images.length || audioDraft)
            && (stage.value !== "delivery" || Boolean(claimSelection?.postId))
            && (!stage.requiresMention || Boolean(effectiveMentionTarget))
            && !audioRecording
            && state.composerState.submitStatus !== "submitting",
        identityDisplay: authStatus !== "authenticated"
            ? guestIdentityDisplay
            : anonymousMode
            ? {
                avatar: activeAlias?.avatar || "",
                name: activeAlias?.name || "匿名用户",
                meta: "系统生成马甲 · 真实身份仅自己可见"
            }
            : {
                avatar: state.runtimeState.realIdentity.avatar,
                name: state.runtimeState.realIdentity.name,
                meta: state.runtimeState.realIdentity.meta
            },
        placeholder: stage.placeholder || (anonymousMode ? composerIdentityPresets.anonymousPlaceholder : composerIdentityPresets.defaultPlaceholder),
        collapsedSummary: draftText.trim()
            ? draftText.trim().slice(0, 72)
            : images.length
                ? `已添加 ${images.length} 张图片`
                : audioDraft
                    ? "已录 1 条语音"
                : stage.taskLabel || (anonymousMode
                    ? "以匿名身份发布想法"
                    : "分享频道里的新动态"),
        hasDraft: Boolean(draftText.trim() || images.length || audioDraft),
        activeAlias,
        claimSelection,
        guessSelection,
        revealResult,
        revealPairs,
        isFreeChatBoard,
        isClaimStage: stage.value === "claim",
        isDeliveryStage: stage.value === "delivery",
        isGuessStage: stage.value === "guess",
        isRevealStage: stage.value === "reveal"
    };
};
