export const applyFeedActions = (draft, action) => {
    switch (action.type) {
    case "feed/set-board":
        draft.feedState.activeBoard = action.payload.board;
        return true;
    case "feed/set-filter":
        draft.feedState.activeFilter = action.payload.filter;
        return true;
    case "feed/set-search-query":
        draft.feedState.searchQuery = action.payload.searchQuery;
        return true;
    case "feed/load-start":
        draft.feedState.status = "loading";
        draft.feedState.error = null;
        return true;
    case "feed/load-success":
        draft.feedState.status = action.payload.items.length ? "ready" : "empty";
        draft.feedState.error = null;
        draft.feedState.items = action.payload.items.map((item) => ({ ...item }));
        return true;
    case "feed/load-error":
        draft.feedState.status = "error";
        draft.feedState.error = action.payload.error;
        return true;
    case "feed/mark-liked":
        if (!draft.feedState.likedPostIds.includes(action.payload.postId)) {
            draft.feedState.likedPostIds.push(action.payload.postId);
        }
        draft.feedState.items = draft.feedState.items.map((item) => (
            item.id === action.payload.postId
                ? { ...item, likes: action.payload.likes }
                : item
        ));
        if (draft.overlayState.comments.post?.id === action.payload.postId) {
            draft.overlayState.comments.post = {
                ...draft.overlayState.comments.post,
                likes: action.payload.likes
            };
        }
        return true;
    case "feed/replace-post":
        draft.feedState.items = draft.feedState.items.map((item) => (
            item.id === action.payload.post.id
                ? { ...action.payload.post }
                : item
        ));
        if (draft.overlayState.comments.post?.id === action.payload.post.id) {
            draft.overlayState.comments.post = {
                ...action.payload.post
            };
        }
        return true;
    default:
        return false;
    }
};
