import {
    anonymizeComposerText,
    cloneComposerAudioForPost,
    cloneComposerImageForPost,
    createImageDraftFromFile,
    generateAnonymousPersona,
    getChannelActionErrorMessage,
    processAnonymousImageForPost,
    readBlobAsDataUrl,
    revokeComposerAudioDraft,
    revokeImageDrafts
} from "../../shared/lib/helpers.js";
import { findCurrentMemberStatus } from "../round/model.js";

const ensureApprovedMember = (store, onGuest, onUnapproved) => {
    const state = store.getState();
    const authStatus = state.authState.status;
    const membershipStatus = state.membershipState.status;

    if (authStatus === "guest") {
        onGuest?.();
        return false;
    }

    if (authStatus === "upgrading_legacy_anonymous") {
        onGuest?.("upgrade");
        return false;
    }

    if (membershipStatus !== "approved") {
        onUnapproved?.(membershipStatus);
        return false;
    }

    return true;
};

const resolveAnonymousComposerMode = (state) => {
    if (state.feedState.activeBoard === "all") {
        return state.composerState.anonymousMode;
    }

    return ["wish", "delivery"].includes(state.roundState.activeStage)
        ? true
        : state.composerState.anonymousMode;
};

export const createComposerActions = ({ store, dataService, showToast, feedActions }) => {
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
            return String(draft?.text || anonymizeComposerText(normalizedText)).trim();
        } catch (error) {
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

    return ({
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
    async refreshAnonymousTextPreview(options = {}) {
        return refreshAnonymousPreview(options);
    },
    toggleMentionMenu() {
        const { mentionOpen } = store.getState().composerState;
        store.dispatch({
            type: "composer/set-field",
            payload: {
                mentionOpen: !mentionOpen,
                proxyWishOpen: false
            }
        });
    },
    toggleProxyWishMenu() {
        const { proxyWishOpen } = store.getState().composerState;
        store.dispatch({
            type: "composer/set-field",
            payload: {
                proxyWishOpen: !proxyWishOpen,
                mentionOpen: false
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
                aiDisclosureOpen: !aiDisclosureOpen
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
        if (!ensureApprovedMember(
            store,
            (mode) => {
                store.dispatch({
                    type: "auth-gate/open",
                    payload: { mode: mode === "upgrade" ? "upgrade" : "login" }
                });
            },
            () => {
                showToast({
                    tone: "info",
                    message: "进入频道后，才能使用匿名发言。"
                });
            }
        )) {
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
        if (!ensureApprovedMember(
            store,
            (mode) => {
                store.dispatch({
                    type: "auth-gate/open",
                    payload: { mode: mode === "upgrade" ? "upgrade" : "login" }
                });
            },
            () => {
                showToast({
                    tone: "info",
                    message: "进入频道后，才能切换匿名马甲。"
                });
            }
        )) {
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
    async regenerateAliasProfile(options = {}) {
        const { silent = false } = options;
        if (!ensureApprovedMember(
            store,
            (mode) => {
                store.dispatch({
                    type: "auth-gate/open",
                    payload: { mode: mode === "upgrade" ? "upgrade" : "login" }
                });
            },
            () => {
                showToast({
                    tone: "info",
                    message: "进入频道后，才能生成匿名马甲。"
                });
            }
        )) {
            return;
        }

        const { activeAliasKey } = store.getState().runtimeState;
        if (!activeAliasKey) {
            return;
        }

        try {
            const nextProfile = generateAnonymousPersona(`${activeAliasKey}-${Date.now()}`);
            const nextAliasState = await dataService.createAliasProfile(activeAliasKey, nextProfile);
            store.dispatch({
                type: "runtime/set-alias-profiles",
                payload: { profiles: nextAliasState.profiles }
            });
            store.dispatch({
                type: "runtime/set-alias-key",
                payload: { key: nextAliasState.activeAliasKey }
            });
            if (!silent) {
                showToast({
                    tone: "success",
                    message: "新马甲已生成。"
                });
            }
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("update_identity", error)
            });
        }
    },
    async addComposerImages(fileList) {
        const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
        if (!files.length) {
            return;
        }

        const state = store.getState();
        let nextImageId = state.composerState.nextImageId;
        const images = files.map((file) => {
            const image = createImageDraftFromFile(file, nextImageId);
            nextImageId += 1;
            return image;
        });

        store.dispatch({
            type: "composer/add-images",
            payload: {
                images,
                nextImageId
            }
        });
    },
    removeComposerImage(id) {
        const image = store.getState().composerState.images.find((item) => item.id === id);
        if (image) {
            revokeImageDrafts([image]);
        }
        store.dispatch({
            type: "composer/remove-image",
            payload: { id }
        });
    },
    async submitPost() {
        if (!ensureApprovedMember(
            store,
            (mode) => {
                store.dispatch({
                    type: "auth-gate/open",
                    payload: { mode: mode === "upgrade" ? "upgrade" : "login" }
                });
            },
            () => {
                showToast({
                    tone: "info",
                    message: "当前频道身份还没同步完成，请稍后再试。"
                });
            }
        )) {
            return;
        }

        const state = store.getState();
        const activeStage = state.roundState.activeStage;
        const activeBoard = state.feedState.activeBoard;
        const effectiveBoard = activeBoard === "all" ? "all" : activeStage;
        const isFreeChatBoard = effectiveBoard === "all";
        const rawText = state.composerState.draftText.trim();
        const images = state.composerState.images;
        const audioDraft = state.composerState.audioDraft;
        if (effectiveBoard !== "guess" && !rawText && !images.length && !audioDraft) {
            return;
        }

        store.dispatch({ type: "composer/submit-start" });

        try {
            const anonymousMode = isFreeChatBoard
                ? state.composerState.anonymousMode
                : (["wish", "delivery"].includes(activeStage) ? true : state.composerState.anonymousMode);
            const claimSelection = state.roundState.claimSelection;
            const guessSelection = state.roundState.guessSelection;
            const currentMemberStatus = findCurrentMemberStatus(state);
            const proxyWishTarget = effectiveBoard === "wish" ? state.composerState.proxyWishTarget : null;
            const mentionTarget = effectiveBoard === "delivery"
                ? (claimSelection
                    ? {
                        name: claimSelection.authorName,
                        avatar: claimSelection.authorAvatar || ""
                    }
                    : null)
                : effectiveBoard === "guess"
                    ? (
                        state.composerState.mentionTarget
                        || (guessSelection
                            ? {
                                name: guessSelection.name,
                                avatar: guessSelection.avatar || ""
                            }
                            : null)
                    )
                    : null;
            if (["delivery", "guess"].includes(effectiveBoard) && currentMemberStatus && !currentMemberStatus.wishSubmitted) {
                store.dispatch({
                    type: "composer/submit-error",
                    payload: { error: new Error("这轮后续流程只对已许愿成员开放。") }
                });
                showToast({
                    tone: "info",
                    message: "你这轮还没入场。需要的话可以让上帝先代你补录愿望。"
                });
                return;
            }
            if (effectiveBoard === "delivery" && !claimSelection?.postId) {
                store.dispatch({
                    type: "composer/submit-error",
                    payload: { error: new Error("请先在选愿望阶段锁定目标。") }
                });
                showToast({
                    tone: "info",
                    message: "先在选愿望阶段锁定 1 条愿望，再回来交付。"
                });
                return;
            }
            if (effectiveBoard === "delivery" && !mentionTarget) {
                store.dispatch({
                    type: "composer/submit-error",
                    payload: { error: new Error("当前交付目标还没有同步完成。") }
                });
                showToast({
                    tone: "info",
                    message: "当前交付目标还没同步出来，刷新后再试。"
                });
                return;
            }
            if (effectiveBoard === "guess" && !mentionTarget) {
                store.dispatch({
                    type: "composer/submit-error",
                    payload: { error: new Error("请先选择你猜的是谁。") }
                });
                showToast({
                    tone: "info",
                    message: "先选你猜的是谁，再提交判断依据。"
                });
                return;
            }
            const shouldAiReshapeImages = anonymousMode && state.composerState.aiImageReshape && images.length > 0;
            const sourceImages = shouldAiReshapeImages
                ? await Promise.all(images.map((image) => cloneComposerImageForPost(image)))
                : null;

            const rewriteAnonymousText = anonymousMode && state.composerState.anonymousTextRewrite;
            const previewSourceMatches = state.composerState.anonymousPreviewSourceText === rawText;
            const previewText = rewriteAnonymousText
                ? (
                    previewSourceMatches && state.composerState.anonymousPreviewText
                        ? state.composerState.anonymousPreviewText
                        : await refreshAnonymousPreview({ immediate: true, force: true })
                )
                : "";
            const anonymizedDraft = anonymousMode && shouldAiReshapeImages
                ? await dataService.anonymizeAnonymousDraft?.({
                    text: rawText,
                    purpose: "post",
                    channelId: state.runtimeState.channel?.id || null,
                    images: shouldAiReshapeImages ? sourceImages : [],
                    reshapeImages: shouldAiReshapeImages
                })
                : null;
            const publishedText = anonymousMode
                ? (rewriteAnonymousText
                    ? (previewText || anonymizeComposerText(rawText))
                    : rawText)
                : rawText;
            const publishedBody = mentionTarget
                ? `@${mentionTarget.name}\n${publishedText || ""}`.trim()
                : (publishedText || "");
            const deliveryMeta = effectiveBoard === "delivery" && claimSelection?.postId
                ? {
                    kind: "delivery_meta",
                    wishPostId: claimSelection.postId,
                    targetMemberName: claimSelection.authorName,
                    targetMemberAvatar: claimSelection.authorAvatar || ""
                }
                : null;
            const wishMeta = effectiveBoard === "wish"
                ? {
                    kind: "wish_meta",
                    participantUserId: proxyWishTarget?.userId || state.authState.user?.id || null,
                    participantName: proxyWishTarget?.name || state.runtimeState.realIdentity.name,
                    participantAvatar: proxyWishTarget?.avatar || state.runtimeState.realIdentity.avatar || "",
                    submissionSource: proxyWishTarget ? "proxy" : "self"
                }
                : null;
            const publishedImages = anonymousMode
                ? (
                    shouldAiReshapeImages && anonymizedDraft?.images?.length === images.length
                        ? anonymizedDraft.images
                        : await Promise.all(images.map((image) => processAnonymousImageForPost(image)))
                )
                : await Promise.all(images.map((image) => cloneComposerImageForPost(image)));
            const publishedAudio = audioDraft
                ? await cloneComposerAudioForPost(audioDraft)
                : null;
            const activeAliasKey = state.runtimeState.activeAliasKey;
            const post = await dataService.publishPost({
                body: publishedBody || (publishedAudio ? "分享一段语音" : "分享一张图片"),
                media: [
                    ...(wishMeta ? [wishMeta] : []),
                    ...(deliveryMeta ? [deliveryMeta] : []),
                    ...publishedImages,
                    ...(publishedAudio ? [publishedAudio] : [])
                ],
                boardSlug: effectiveBoard,
                aiDisclosure: anonymousMode ? "none" : state.composerState.aiDisclosure,
                author: anonymousMode
                    ? { type: "alias_session", key: activeAliasKey }
                    : { type: "identity" }
            });
            const savedGuessSelection = effectiveBoard === "guess" && mentionTarget
                ? await dataService.saveGuessSelection(mentionTarget)
                : null;

            revokeImageDrafts(images);
            if (audioDraft) {
                revokeComposerAudioDraft(audioDraft);
            }
            resetAnonymousPreview();
            store.dispatch({ type: "composer/reset" });
            if (["wish", "delivery", "guess"].includes(effectiveBoard)) {
                store.dispatch({
                    type: "round/mark-progress",
                    payload: {
                        wishSubmitted: state.roundState.progress.wishSubmitted || effectiveBoard === "wish",
                        deliverySubmitted: state.roundState.progress.deliverySubmitted || effectiveBoard === "delivery",
                        guessSubmitted: state.roundState.progress.guessSubmitted || effectiveBoard === "guess"
                    }
                });
            }
            if (savedGuessSelection) {
                store.dispatch({
                    type: "round/set-guess-selection",
                    payload: { selection: savedGuessSelection }
                });
            }
            if (anonymousMode) {
                await this.regenerateAliasProfile({ silent: true });
            }

            if (effectiveBoard === "delivery" && state.runtimeState.channel?.slug === "demo") {
                await feedActions.setActiveBoard("guess");
            } else {
                const targetBoard = post.board === "none" ? "all" : post.board;
                await feedActions.loadFeed(targetBoard);
            }
            showToast({
                tone: "success",
                message: effectiveBoard === "delivery"
                    ? "交付已提交，已切到猜测阶段。"
                    : effectiveBoard === "wish" && proxyWishTarget
                        ? `已代 ${proxyWishTarget.name} 记录愿望。`
                    : anonymousMode
                        ? "匿名帖子已发送。"
                        : "帖子已发送。"
            });
        } catch (error) {
            store.dispatch({
                type: "composer/submit-error",
                payload: { error }
            });
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("publish_post", error)
            });
        }
    },
    openIdentityDialog() {
        if (!ensureApprovedMember(
            store,
            (mode) => {
                store.dispatch({
                    type: "auth-gate/open",
                    payload: { mode: mode === "upgrade" ? "upgrade" : "login" }
                });
            },
            () => {
                showToast({
                    tone: "info",
                    message: "只有已加入频道的成员才能编辑频道身份。"
                });
            }
        )) {
            return;
        }
        store.dispatch({ type: "identity/open" });
    },
    closeIdentityDialog() {
        store.dispatch({ type: "identity/close" });
    },
    setIdentityDraft(partial) {
        store.dispatch({
            type: "identity/set-field",
            payload: partial
        });
    },
    async setIdentityAvatar(file) {
        if (!file) {
            return;
        }

        try {
            const draftAvatar = await readBlobAsDataUrl(file);
            this.setIdentityDraft({ draftAvatar });
        } catch (error) {
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("read_avatar", error)
            });
        }
    },
    async saveIdentity() {
        const state = store.getState();
        const draftName = state.overlayState.identity.draftName.trim();
        if (!draftName) {
            return;
        }

        store.dispatch({ type: "identity/save-start" });

        try {
            const nextIdentity = await dataService.updateIdentity({
                displayName: draftName,
                avatarUrl: state.overlayState.identity.draftAvatar,
                meta: state.runtimeState.realIdentity.meta
            });
            store.dispatch({
                type: "runtime/update-identity",
                payload: { identity: nextIdentity }
            });
            store.dispatch({ type: "identity/save-finish" });
            showToast({
                tone: "success",
                message: "频道身份已更新。"
            });
        } catch (error) {
            store.dispatch({
                type: "identity/save-error",
                payload: { error }
            });
            showToast({
                tone: "error",
                message: getChannelActionErrorMessage("update_identity", error)
            });
        }
    }
    });
};
