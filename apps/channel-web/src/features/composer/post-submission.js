import {
    anonymizeComposerText,
    cloneComposerAudioForPost,
    cloneComposerImageForPost,
    createImageDraftFromFile,
    generateAnonymousPersona,
    getChannelActionErrorMessage,
    looksLikeAnsweredPromptInsteadOfRewrite,
    processAnonymousImageForPost,
    revokeComposerAudioDraft,
    revokeImageDrafts
} from "../../shared/lib/helpers.js";
import { findCurrentMemberStatus } from "../round/model.js";

export const createComposerPostActions = ({
    store,
    dataService,
    showToast,
    feedActions,
    ensureMemberAccess,
    resolveAnonymousComposerMode,
    refreshAnonymousPreview,
    resetAnonymousPreview,
    actions
}) => ({
    async regenerateAliasProfile(options = {}) {
        const { silent = false } = options;
        if (!ensureMemberAccess({
            unapprovedMessage: "进入频道后，才能生成匿名马甲。"
        })) {
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
        if (!ensureMemberAccess({
            unapprovedMessage: "当前频道身份还没同步完成，请稍后再试。"
        })) {
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
            const safePreviewText = previewText && !looksLikeAnsweredPromptInsteadOfRewrite(rawText, previewText)
                ? previewText
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
                    ? (safePreviewText || anonymizeComposerText(rawText))
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
                    submissionSource: proxyWishTarget ? "proxy" : "self",
                    recordedByUserId: proxyWishTarget ? (state.authState.user?.id || null) : null,
                    recordedByName: proxyWishTarget ? state.runtimeState.realIdentity.name : ""
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
                await actions.regenerateAliasProfile({ silent: true });
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
    }
});
