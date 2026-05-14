export const attachFeedListEvents = ({ root, store, actions }) => {
    root.addEventListener("click", (event) => {
        const guessTargetButton = event.target.closest("[data-feed-action='select-guess-target']");
        if (guessTargetButton) {
            actions.selectMentionTarget({
                name: decodeURIComponent(guessTargetButton.dataset.guessName || ""),
                avatar: decodeURIComponent(guessTargetButton.dataset.guessAvatar || "")
            });
            return;
        }

        const excludeGuessButton = event.target.closest("[data-feed-action='toggle-guess-exclusion']");
        if (excludeGuessButton) {
            actions.toggleGuessExcludedMember?.(decodeURIComponent(excludeGuessButton.dataset.guessName || ""));
            return;
        }

        const submitGuessButton = event.target.closest("[data-feed-action='submit-guess']");
        if (submitGuessButton) {
            void actions.submitGuessStage?.();
            return;
        }

        const stateAction = event.target.closest("[data-feed-action='retry']");
        if (stateAction) {
            void actions.loadFeed(store.getState().feedState.activeBoard);
            return;
        }

        const commentsButton = event.target.closest("[data-feed-action='open-comments']");
        const bodyButton = event.target.closest("[data-feed-action='open-post-body']");
        const imageButton = event.target.closest("[data-feed-action='open-image']");
        const relatedPostButton = event.target.closest("[data-feed-action='open-related-post']");
        const likeButton = event.target.closest("[data-feed-action='like-post']");
        const shareButton = event.target.closest("[data-feed-action='share-post']");
        const claimButton = event.target.closest("[data-feed-action='claim-wish']");
        const deleteButton = event.target.closest("[data-feed-action='request-delete-post']");
        if (claimButton) {
            const article = claimButton.closest("[data-post-id]");
            if (!article) {
                return;
            }

            void actions.claimWish(article.dataset.postId);
            return;
        }

        if (likeButton) {
            const article = likeButton.closest("[data-post-id]");
            if (!article) {
                return;
            }

            void actions.likePost(article.dataset.postId);
            return;
        }

        if (shareButton) {
            const article = shareButton.closest("[data-post-id]");
            if (!article) {
                return;
            }

            void actions.sharePost?.(article.dataset.postId);
            return;
        }

        if (deleteButton) {
            const article = deleteButton.closest("[data-post-id]");
            if (!article) {
                return;
            }

            actions.requestDeletePost(article.dataset.postId);
            return;
        }

        if (imageButton) {
            const article = imageButton.closest("[data-post-id]");
            if (!article) {
                return;
            }

            actions.openPostImage(article.dataset.postId, Number(imageButton.dataset.imageIndex || 0));
            return;
        }

        if (relatedPostButton) {
            actions.openOverlay("comments", {
                postId: relatedPostButton.dataset.relatedPostId,
                source: "body"
            });
            return;
        }

        if (!commentsButton && !bodyButton) {
            return;
        }

        const article = (commentsButton || bodyButton).closest("[data-post-id]");
        if (!article) {
            return;
        }

        actions.openOverlay("comments", {
            postId: article.dataset.postId,
            source: bodyButton ? "body" : "comments"
        });
    });

    root.addEventListener("input", (event) => {
        const guessReasonInput = event.target.closest("[data-feed-input='guess-reason']");
        if (!guessReasonInput) {
            return;
        }
        actions.setGuessDraftText?.(guessReasonInput.value);
    });
};
