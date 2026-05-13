import { gameBoardStages, getNextRoundStage } from "../../entities/channel/config.js";
import { downloadJsonFile, getChannelActionErrorMessage } from "../../shared/lib/helpers.js";
import {
    attachGuessToRevealMap,
    attachWishPreviewToRevealMap,
    buildGuessByMemberName,
    buildRevealPairs,
    buildRevealMapFromDeliveryPosts,
    buildRoundCompletionSummary,
    buildWishPreviewByMemberName,
    getRoundDeadlinesForSave,
    getRoundStage
} from "./model.js";

export const createRoundActions = ({ store, dataService, showToast, loadFeed }) => {
    const canManageRound = (state) => ["owner", "admin"].includes(state.runtimeState.realIdentity.role);
    const canEditRoundTheme = (state) => canManageRound(state)
        || state.runtimeState.realIdentity.name === state.roundState.godProfile?.name;

    const actions = {
        async refreshCurrentRound({ silent = false } = {}) {
            if (typeof dataService.loadCurrentRound !== "function") {
                return null;
            }

            try {
                if (typeof dataService.syncCurrentRoundWishDeadline === "function") {
                    const nextChannel = await dataService.syncCurrentRoundWishDeadline();
                    if (nextChannel) {
                        store.dispatch({
                            type: "runtime/update-channel",
                            payload: { channel: nextChannel }
                        });
                    }
                }
                const round = await dataService.loadCurrentRound();
                if (round) {
                    store.dispatch({
                        type: "round/set-current-round",
                        payload: { round }
                    });
                }
                return round;
            } catch (error) {
                if (!silent) {
                    showToast({
                        tone: "error",
                        message: getChannelActionErrorMessage("load_round_state", error)
                    });
                }
                return null;
            }
        },
        async refreshRoundMemberStatuses({ silent = false } = {}) {
            const state = store.getState();
            if (
                state.membershipState.status !== "approved"
                || typeof dataService.listRoundMemberStatuses !== "function"
            ) {
                store.dispatch({
                    type: "round/set-member-statuses",
                    payload: { items: [] }
                });
                return [];
            }

            try {
                const items = await dataService.listRoundMemberStatuses();
                store.dispatch({
                    type: "round/set-member-statuses",
                    payload: { items }
                });
                return items;
            } catch (error) {
                if (!silent) {
                    showToast({
                        tone: "error",
                        message: getChannelActionErrorMessage("load_round_state", error)
                    });
                }
                return [];
            }
        },
        async refreshRoundArchives({ silent = false } = {}) {
            const listArchives = dataService.listArchivedRounds || dataService.listRoundArchives;
            if (typeof listArchives !== "function") {
                store.dispatch({
                    type: "round/set-archives",
                    payload: { items: [] }
                });
                store.dispatch({
                    type: "channel-intelligence/set-field",
                    payload: { selectedArchiveId: null }
                });
                return [];
            }

            try {
                const nextItems = await listArchives.call(dataService);
                const items = Array.isArray(nextItems) ? nextItems : [];
                const currentSelectedArchiveId = store.getState().overlayState.channelIntelligence.selectedArchiveId;
                const nextSelectedArchiveId = items.some((item) => item.id === currentSelectedArchiveId)
                    ? currentSelectedArchiveId
                    : null;
                store.dispatch({
                    type: "round/set-archives",
                    payload: { items }
                });
                store.dispatch({
                    type: "channel-intelligence/set-field",
                    payload: { selectedArchiveId: nextSelectedArchiveId }
                });
                return items;
            } catch (error) {
                if (!silent) {
                    showToast({
                        tone: "error",
                        message: getChannelActionErrorMessage("load_round_state", error)
                    });
                }
                return [];
            }
        },
        async selectRoundArchive(archiveId) {
            const normalizedArchiveId = String(archiveId || "").trim() || null;
            if (!normalizedArchiveId) {
                store.dispatch({
                    type: "channel-intelligence/set-field",
                    payload: {
                        selectedArchiveId: null,
                        archiveDetailOpen: false
                    }
                });
                store.dispatch({
                    type: "round/set-archive-viewer",
                    payload: {
                        roundId: null,
                        detail: null
                    }
                });
                return;
            }

            store.dispatch({
                type: "channel-intelligence/set-field",
                payload: {
                    selectedArchiveId: normalizedArchiveId,
                    archiveDetailOpen: true
                }
            });

            if (typeof dataService.getArchivedRoundDetail !== "function") {
                return;
            }

            try {
                const detail = await dataService.getArchivedRoundDetail(normalizedArchiveId);
                store.dispatch({
                    type: "round/set-archive-viewer",
                    payload: {
                        roundId: null,
                        detail
                    }
                });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("load_round_state", error)
                });
            }
        },
        async viewSelectedArchiveInBoard(roundId = store.getState().overlayState.channelIntelligence.selectedArchiveId) {
            const normalizedRoundId = String(roundId || "").trim();
            if (!normalizedRoundId || typeof dataService.getArchivedRoundDetail !== "function") {
                return;
            }

            try {
                const detail = await dataService.getArchivedRoundDetail(normalizedRoundId);
                store.dispatch({
                    type: "round/set-archive-viewer",
                    payload: {
                        roundId: normalizedRoundId,
                        detail
                    }
                });
                store.dispatch({
                    type: "channel-intelligence/set-field",
                    payload: {
                        selectedArchiveId: normalizedRoundId,
                        archiveDetailOpen: false
                    }
                });
                await loadFeed(store.getState().feedState.activeBoard);
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("load_round_state", error)
                });
            }
        },
        closeArchiveDetail() {
            store.dispatch({
                type: "channel-intelligence/set-field",
                payload: { archiveDetailOpen: false }
            });
        },
        async exitArchiveViewer() {
            store.dispatch({
                type: "round/set-archive-viewer",
                payload: {
                    roundId: null,
                    detail: null
                }
            });
            store.dispatch({
                type: "channel-intelligence/set-field",
                payload: {
                    archiveDetailOpen: false,
                    selectedArchiveId: null
                }
            });
            await loadFeed(store.getState().feedState.activeBoard);
        },
        toggleRoundGodPicker() {
            const current = store.getState().overlayState.roundManagement.godPickerOpen;
            store.dispatch({
                type: "round-management/set-field",
                payload: {
                    godPickerOpen: !current,
                    themeEditorOpen: false,
                    deadlineEditorOpen: false
                }
            });
        },
        async assignRoundGod(godProfile) {
            const state = store.getState();
            if (!canManageRound(state)) {
                showToast({
                    tone: "info",
                    message: "只有频道管理员才能指定本周上帝。"
                });
                return;
            }

            try {
                const nextChannel = await dataService.updateChannelRoundState({ godProfile });
                store.dispatch({
                    type: "runtime/update-channel",
                    payload: { channel: nextChannel }
                });
                store.dispatch({
                    type: "round-management/set-field",
                    payload: {
                        godPickerOpen: false,
                        themeEditorOpen: false,
                        deadlineEditorOpen: false
                    }
                });
                showToast({
                    tone: "success",
                    message: "本周上帝已更新。"
                });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("archive_round", error)
                });
            }
        },
        toggleRoundThemeEditor() {
            const state = store.getState();
            const current = state.overlayState.roundManagement.themeEditorOpen;
            store.dispatch({
                type: "round-management/set-field",
                payload: {
                    godPickerOpen: false,
                    themeEditorOpen: !current,
                    deadlineEditorOpen: false,
                    draftTheme: state.roundState.theme || ""
                }
            });
        },
        cancelRoundThemeEditing() {
            store.dispatch({
                type: "round-management/set-field",
                payload: {
                    themeEditorOpen: false,
                    draftTheme: store.getState().roundState.theme || ""
                }
            });
        },
        setRoundThemeDraft(value) {
            store.dispatch({
                type: "round-management/set-field",
                payload: { draftTheme: value }
            });
        },
        toggleRoundDeadlineEditor() {
            const state = store.getState();
            const current = state.overlayState.roundManagement.deadlineEditorOpen;
            store.dispatch({
                type: "round-management/set-field",
                payload: {
                    godPickerOpen: false,
                    themeEditorOpen: false,
                    deadlineEditorOpen: !current,
                    draftDeadlines: {
                        ...(state.roundState.deadlines || {})
                    }
                }
            });
        },
        cancelRoundDeadlineEditing() {
            store.dispatch({
                type: "round-management/set-field",
                payload: {
                    deadlineEditorOpen: false,
                    draftDeadlines: {
                        ...(store.getState().roundState.deadlines || {})
                    }
                }
            });
        },
        setRoundDeadlineDraft(stage, value) {
            const normalizedStage = String(stage || "").trim();
            if (!gameBoardStages.some((item) => item.value === normalizedStage)) {
                return;
            }

            const currentDrafts = store.getState().overlayState.roundManagement.draftDeadlines || {};
            store.dispatch({
                type: "round-management/set-field",
                payload: {
                    draftDeadlines: {
                        ...currentDrafts,
                        [normalizedStage]: {
                            ...(currentDrafts[normalizedStage] || store.getState().roundState.deadlines?.[normalizedStage] || {}),
                            deadlineAt: String(value || "").trim() || null
                        }
                    }
                }
            });
        },
        async saveRoundDeadlines() {
            const state = store.getState();
            if (!canManageRound(state)) {
                showToast({
                    tone: "info",
                    message: "只有频道管理员才能更新回合截止时间。"
                });
                return;
            }

            try {
                const nextChannel = await dataService.updateChannelRoundState({
                    deadlines: getRoundDeadlinesForSave(state)
                });
                store.dispatch({
                    type: "runtime/update-channel",
                    payload: { channel: nextChannel }
                });
                store.dispatch({
                    type: "round-management/set-field",
                    payload: { deadlineEditorOpen: false }
                });
                showToast({
                    tone: "success",
                    message: "回合截止时间已更新。"
                });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("archive_round", error)
                });
            }
        },
        toggleRoundRevealEditor() {
            const state = store.getState();
            const current = state.overlayState.roundManagement.revealEditorOpen;
            store.dispatch({
                type: "round-management/set-field",
                payload: {
                    godPickerOpen: false,
                    themeEditorOpen: false,
                    deadlineEditorOpen: false,
                    revealEditorOpen: !current,
                    revealMemberPickerOpen: false,
                    revealAngelPickerOpen: false,
                    draftRevealMember: current ? null : state.overlayState.roundManagement.draftRevealMember,
                    draftRevealAngel: current ? null : state.overlayState.roundManagement.draftRevealAngel
                }
            });
        },
        toggleRoundRevealMemberPicker() {
            const current = store.getState().overlayState.roundManagement.revealMemberPickerOpen;
            store.dispatch({
                type: "round-management/set-field",
                payload: {
                    revealMemberPickerOpen: !current,
                    revealAngelPickerOpen: false
                }
            });
        },
        toggleRoundRevealAngelPicker() {
            const current = store.getState().overlayState.roundManagement.revealAngelPickerOpen;
            store.dispatch({
                type: "round-management/set-field",
                payload: {
                    revealAngelPickerOpen: !current,
                    revealMemberPickerOpen: false
                }
            });
        },
        chooseRoundRevealMember(member) {
            store.dispatch({
                type: "round-management/set-field",
                payload: {
                    draftRevealMember: member ? { ...member } : null,
                    revealMemberPickerOpen: false
                }
            });
        },
        chooseRoundRevealAngel(member) {
            store.dispatch({
                type: "round-management/set-field",
                payload: {
                    draftRevealAngel: member ? { ...member } : null,
                    revealAngelPickerOpen: false
                }
            });
        },
        async saveRoundRevealPair() {
            const state = store.getState();
            if (!canManageRound(state)) {
                showToast({
                    tone: "info",
                    message: "只有频道管理员才能配置揭晓结果。"
                });
                return;
            }

            const draftMember = state.overlayState.roundManagement.draftRevealMember;
            const draftAngel = state.overlayState.roundManagement.draftRevealAngel;
            if (!draftMember?.name || !draftAngel?.name) {
                showToast({
                    tone: "info",
                    message: "先选要揭晓的成员，再选他对应的天使。"
                });
                return;
            }

            if (draftMember.name === draftAngel.name) {
                showToast({
                    tone: "info",
                    message: "揭晓对象和天使不能是同一个人。"
                });
                return;
            }

            const currentEntry = state.roundState.revealMap?.[draftMember.name] || null;
            let wishPreviewByMemberName = new Map();
            let guessByMemberName = new Map();

            try {
                const [wishPosts, guessSelections] = await Promise.all([
                    dataService.listPosts("wish"),
                    dataService.listChannelGuessSelections?.() || []
                ]);
                wishPreviewByMemberName = buildWishPreviewByMemberName(wishPosts);
                guessByMemberName = buildGuessByMemberName(guessSelections);
            } catch {
                showToast({
                    tone: "info",
                    message: "已继续保存揭晓配对，但当前没拿到这位国王的愿望或猜测摘要。"
                });
            }

            const nextRevealMap = attachGuessToRevealMap(attachWishPreviewToRevealMap({
                ...(state.roundState.revealMap || {}),
                [draftMember.name]: {
                    member: {
                        name: draftMember.name,
                        avatar: draftMember.avatar || ""
                    },
                    angel: {
                        name: draftAngel.name,
                        avatar: draftAngel.avatar || ""
                    },
                    wishPostId: currentEntry?.wishPostId || null,
                    wishPreview: currentEntry?.wishPreview || "",
                    guessedAngelName: currentEntry?.guessedAngelName || "",
                    guessedAngelAvatar: currentEntry?.guessedAngelAvatar || "",
                    updatedAt: new Date().toISOString()
                }
            }, wishPreviewByMemberName), guessByMemberName);

            try {
                const nextChannel = await dataService.updateChannelRoundState({
                    revealMap: nextRevealMap
                });
                store.dispatch({
                    type: "runtime/update-channel",
                    payload: { channel: nextChannel }
                });
                store.dispatch({
                    type: "round-management/set-field",
                    payload: {
                        revealEditorOpen: false,
                        revealMemberPickerOpen: false,
                        revealAngelPickerOpen: false,
                        draftRevealMember: null,
                        draftRevealAngel: null
                    }
                });
                showToast({
                    tone: "success",
                    message: "揭晓配对已保存。"
                });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("restore_round_archive", error)
                });
            }
        },
        async generateRoundRevealResults() {
            const state = store.getState();
            if (!canManageRound(state)) {
                showToast({
                    tone: "info",
                    message: "只有频道管理员才能生成揭晓结果。"
                });
                return;
            }

            try {
                const [deliveryPosts, wishPosts, guessSelections] = await Promise.all([
                    dataService.listPosts("delivery"),
                    dataService.listPosts("wish"),
                    dataService.listChannelGuessSelections?.() || []
                ]);
                const revealMap = buildRevealMapFromDeliveryPosts(deliveryPosts, {
                    realIdentity: state.runtimeState.realIdentity
                });
                const withWishPreview = attachWishPreviewToRevealMap(revealMap, buildWishPreviewByMemberName(wishPosts));
                const nextRevealMap = attachGuessToRevealMap(withWishPreview, buildGuessByMemberName(guessSelections));
                const pairCount = Object.keys(nextRevealMap).length;

                if (!pairCount) {
                    showToast({
                        tone: "info",
                        message: "还没有足够的交付数据可用于生成揭晓结果。"
                    });
                    return;
                }

                const nextChannel = await dataService.updateChannelRoundState({
                    revealMap: nextRevealMap
                });
                store.dispatch({
                    type: "runtime/update-channel",
                    payload: { channel: nextChannel }
                });
                store.dispatch({
                    type: "round-management/set-field",
                    payload: {
                        revealEditorOpen: false,
                        revealMemberPickerOpen: false,
                        revealAngelPickerOpen: false,
                        draftRevealMember: null,
                        draftRevealAngel: null
                    }
                });
                showToast({
                    tone: "success",
                    message: `已根据交付内容生成 ${pairCount} 对揭晓结果。`
                });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("update_round_state", error)
                });
            }
        },
        async saveRoundTheme() {
            const state = store.getState();
            if (!canEditRoundTheme(state)) {
                showToast({
                    tone: "info",
                    message: "只有本周上帝或频道管理员才能设定主题。"
                });
                return;
            }

            const draftTheme = state.overlayState.roundManagement.draftTheme.trim();
            if (!draftTheme) {
                showToast({
                    tone: "info",
                    message: "先输入本周主题。"
                });
                return;
            }

            try {
                const nextChannel = await dataService.updateChannelRoundState({ theme: draftTheme });
                store.dispatch({
                    type: "runtime/update-channel",
                    payload: { channel: nextChannel }
                });
                store.dispatch({
                    type: "round-management/set-field",
                    payload: { themeEditorOpen: false }
                });
                showToast({
                    tone: "success",
                    message: "本周主题已更新。"
                });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("update_round_state", error)
                });
            }
        },
        async startRoundCycle() {
            const state = store.getState();
            if (!canManageRound(state)) {
                showToast({
                    tone: "info",
                    message: "只有频道管理员才能开始新一轮。"
                });
                return;
            }

            if (typeof dataService.archiveCurrentRound !== "function") {
                showToast({
                    tone: "error",
                    message: "当前环境还没接上真正的新回合创建能力。"
                });
                return;
            }

            try {
                const nextChannel = await dataService.archiveCurrentRound({ mode: "normal" });
                store.dispatch({
                    type: "runtime/update-channel",
                    payload: { channel: nextChannel }
                });
                await actions.refreshCurrentRound({ silent: true });
                store.dispatch({ type: "round/reset-transient-progress" });
                await actions.refreshRoundMemberStatuses({ silent: true });
                await actions.refreshRoundArchives({ silent: true });
                await loadFeed("wish");
                showToast({
                    tone: "success",
                    message: "上一轮已归档，当前已切到新一轮。"
                });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("archive_round", error)
                });
            }
        },
        async setRoundStage(stage, { allowIncomplete = true } = {}) {
            const state = store.getState();
            if (!canManageRound(state)) {
                showToast({
                    tone: "info",
                    message: "只有频道管理员才能切换阶段。"
                });
                return;
            }

            const normalizedStage = getRoundStage(stage).value;
            const summary = buildRoundCompletionSummary(state.roundState.memberStatuses);
            if (!allowIncomplete && normalizedStage === "claim" && !summary.readyForClaim) {
                showToast({
                    tone: "info",
                    message: "还有成员没完成许愿，暂时不能进入选愿望。"
                });
                return;
            }
            if (!allowIncomplete && normalizedStage === "delivery" && !summary.readyForDelivery) {
                showToast({
                    tone: "info",
                    message: "还有成员没完成选愿望，暂时不能进入交付。"
                });
                return;
            }
            if (!allowIncomplete && normalizedStage === "guess" && !summary.readyForGuess) {
                showToast({
                    tone: "info",
                    message: "还有成员没完成交付，暂时不能进入猜测。"
                });
                return;
            }
            if (!allowIncomplete && normalizedStage === "reveal" && !summary.readyForReveal) {
                showToast({
                    tone: "info",
                    message: "还有成员没完成猜测，暂时不能进入揭晓。"
                });
                return;
            }

            try {
                const nextChannel = await dataService.updateChannelRoundState({
                    stage: normalizedStage,
                    status: normalizedStage === "reveal" ? state.roundState.status : "active",
                    completedAt: normalizedStage === "reveal" && state.roundState.status === "archived"
                        ? state.roundState.completedAt
                        : null
                });
                store.dispatch({
                    type: "runtime/update-channel",
                    payload: { channel: nextChannel }
                });
                await loadFeed(normalizedStage);
                showToast({
                    tone: "success",
                    message: `当前阶段已切换到${getRoundStage(normalizedStage).label}。`
                });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("update_round_state", error)
                });
            }
        },
        async advanceRoundStage() {
            const state = store.getState();
            const nextStage = getNextRoundStage(state.roundState.activeStage);
            if (!nextStage) {
                showToast({
                    tone: "info",
                    message: "当前已经是最后一个阶段。"
                });
                return;
            }

            await actions.setRoundStage(nextStage, { allowIncomplete: false });
        },
        async completeRoundCycle() {
            const state = store.getState();
            if (!canManageRound(state)) {
                showToast({
                    tone: "info",
                    message: "只有频道管理员才能结束本轮。"
                });
                return;
            }

            try {
                const nextChannel = typeof dataService.archiveCurrentRound === "function"
                    ? await dataService.archiveCurrentRound({ mode: "normal" })
                    : await dataService.updateChannelRoundState({
                        stage: "reveal",
                        status: "archived",
                        completedAt: new Date().toISOString()
                    });
                store.dispatch({
                    type: "runtime/update-channel",
                    payload: { channel: nextChannel }
                });
                await actions.refreshCurrentRound({ silent: true });
                store.dispatch({ type: "round/reset-transient-progress" });
                await actions.refreshRoundMemberStatuses({ silent: true });
                await actions.refreshRoundArchives({ silent: true });
                await loadFeed("wish");
                showToast({
                    tone: "success",
                    message: "本轮已归档，新一轮已开始。"
                });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("archive_round", error)
                });
            }
        },
        async forceArchiveCurrentRound() {
            const state = store.getState();
            if (!canManageRound(state)) {
                showToast({
                    tone: "info",
                    message: "只有频道管理员才能强制归档。"
                });
                return;
            }

            const reason = window.prompt("请输入强制归档原因");
            if (reason === null) {
                return;
            }

            try {
                const nextChannel = await dataService.archiveCurrentRound({
                    mode: "forced",
                    reason
                });
                store.dispatch({
                    type: "runtime/update-channel",
                    payload: { channel: nextChannel }
                });
                await actions.refreshCurrentRound({ silent: true });
                store.dispatch({ type: "round/reset-transient-progress" });
                await actions.refreshRoundMemberStatuses({ silent: true });
                await actions.refreshRoundArchives({ silent: true });
                await loadFeed("wish");
                showToast({
                    tone: "success",
                    message: "当前回合已强制归档，新一轮已开始。"
                });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("archive_round", error)
                });
            }
        },
        async restoreArchivedRound(roundId = store.getState().overlayState.channelIntelligence.selectedArchiveId) {
            const normalizedRoundId = String(roundId || "").trim();
            if (!normalizedRoundId) {
                return;
            }

            try {
                const nextChannel = await dataService.restoreArchivedRound(normalizedRoundId);
                store.dispatch({
                    type: "runtime/update-channel",
                    payload: { channel: nextChannel }
                });
                store.dispatch({
                    type: "round/set-archive-viewer",
                    payload: {
                        roundId: null,
                        detail: null
                    }
                });
                store.dispatch({
                    type: "channel-intelligence/set-field",
                    payload: {
                        archiveDetailOpen: false,
                        selectedArchiveId: null
                    }
                });
                await actions.refreshCurrentRound({ silent: true });
                await actions.refreshRoundMemberStatuses({ silent: true });
                await actions.refreshRoundArchives({ silent: true });
                await loadFeed(store.getState().feedState.activeBoard);
                showToast({
                    tone: "success",
                    message: "归档内容已恢复为当前回合。"
                });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("update_round_state", error)
                });
            }
        },
        async renameArchivedRound(roundId = store.getState().overlayState.channelIntelligence.selectedArchiveId) {
            const normalizedRoundId = String(roundId || "").trim();
            if (!normalizedRoundId) {
                return;
            }

            const archive = (store.getState().roundState.archives || []).find((item) => item.id === normalizedRoundId) || null;
            const nextTitle = window.prompt("请输入归档标题", archive?.title || archive?.defaultTitle || "");
            if (nextTitle === null) {
                return;
            }

            try {
                const detail = await dataService.renameArchivedRound(normalizedRoundId, nextTitle);
                store.dispatch({
                    type: "round/set-archive-viewer",
                    payload: {
                        roundId: normalizedRoundId,
                        detail
                    }
                });
                await actions.refreshRoundArchives({ silent: true });
                showToast({
                    tone: "success",
                    message: "归档标题已更新。"
                });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("rename_round_archive", error)
                });
            }
        },
        async exportArchivedRound(roundId = store.getState().overlayState.channelIntelligence.selectedArchiveId) {
            const normalizedRoundId = String(roundId || "").trim();
            if (!normalizedRoundId || typeof dataService.getArchivedRoundDetail !== "function") {
                return;
            }

            try {
                const state = store.getState();
                const currentDetail = state.roundState.archiveViewerDetail?.id === normalizedRoundId
                    ? state.roundState.archiveViewerDetail
                    : null;
                const detail = currentDetail || await dataService.getArchivedRoundDetail(normalizedRoundId);
                if (!detail) {
                    throw new Error("当前归档详情还没有加载完成。");
                }

                const channel = state.runtimeState.channel || {};
                const archiveTitle = String(detail.title || detail.theme || detail.defaultTitle || "archive").trim() || "archive";
                const safeTitle = archiveTitle
                    .replace(/[\\/:*?"<>|]+/g, "-")
                    .replace(/\s+/g, "-")
                    .slice(0, 48)
                    .replace(/^-+|-+$/g, "") || "archive";
                const completedDate = String(detail.completedAt || detail.createdAt || "").slice(0, 10) || "unknown-date";

                downloadJsonFile(
                    `${String(channel.slug || "channel").trim() || "channel"}-${completedDate}-${safeTitle}.json`,
                    {
                        exportedAt: new Date().toISOString(),
                        channel: {
                            id: channel.id || null,
                            slug: channel.slug || "",
                            name: channel.name || ""
                        },
                        archive: detail
                    }
                );
                showToast({
                    tone: "success",
                    message: "往期回合备份已导出。"
                });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("export_round_archive", error)
                });
            }
        },
        async deleteArchivedRound(roundId = store.getState().overlayState.channelIntelligence.selectedArchiveId) {
            const normalizedRoundId = String(roundId || "").trim();
            if (!normalizedRoundId || typeof dataService.deleteArchivedRound !== "function") {
                return;
            }

            const archive = (store.getState().roundState.archives || []).find((item) => item.id === normalizedRoundId) || null;
            const confirmed = window.confirm(
                `删除“${archive?.title || archive?.theme || archive?.defaultTitle || "这条往期回合"}”后，记录不能恢复。确认删除吗？`
            );
            if (!confirmed) {
                return;
            }

            try {
                await dataService.deleteArchivedRound(normalizedRoundId);
                if (store.getState().roundState.archiveViewerRoundId === normalizedRoundId) {
                    store.dispatch({
                        type: "round/set-archive-viewer",
                        payload: {
                            roundId: null,
                            detail: null
                        }
                    });
                    await loadFeed(store.getState().feedState.activeBoard);
                }
                store.dispatch({
                    type: "channel-intelligence/set-field",
                    payload: {
                        archiveDetailOpen: false,
                        selectedArchiveId: null
                    }
                });
                await actions.refreshRoundArchives({ silent: true });
                showToast({
                    tone: "success",
                    message: "往期回合记录已删除。"
                });
            } catch (error) {
                showToast({
                    tone: "error",
                    message: getChannelActionErrorMessage("delete_round_archive", error)
                });
            }
        }
    };

    return actions;
};
