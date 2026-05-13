import { cloneSimple } from "./helpers.js";

export const cloneState = (state) => ({
    ...state,
    runtimeState: {
        ...state.runtimeState,
        channel: cloneSimple(state.runtimeState.channel),
        realIdentity: { ...state.runtimeState.realIdentity },
        anonymousProfiles: state.runtimeState.anonymousProfiles.map((profile) => ({ ...profile }))
    },
    authState: {
        ...state.authState,
        user: cloneSimple(state.authState.user)
    },
    membershipState: {
        ...state.membershipState,
        joinRequest: cloneSimple(state.membershipState.joinRequest),
        reviewItems: state.membershipState.reviewItems.map((item) => ({ ...item })),
        directoryItems: (state.membershipState.directoryItems || []).map((item) => ({ ...item }))
    },
    channelCreateState: {
        ...state.channelCreateState
    },
    roundState: {
        ...state.roundState,
        deadlines: { ...(state.roundState.deadlines || {}) },
        completionSnapshot: state.roundState.completionSnapshot ? { ...state.roundState.completionSnapshot } : {},
        memberStatuses: (state.roundState.memberStatuses || []).map((item) => ({ ...item })),
        claimSelection: cloneSimple(state.roundState.claimSelection),
        guessSelection: cloneSimple(state.roundState.guessSelection),
        guessExcludedNames: [...(state.roundState.guessExcludedNames || [])],
        revealMap: { ...(state.roundState.revealMap || {}) },
        godProfile: cloneSimple(state.roundState.godProfile),
        archives: (state.roundState.archives || []).map((archive) => ({
            ...archive,
            godProfile: cloneSimple(archive.godProfile),
            savedBy: cloneSimple(archive.savedBy),
            deadlines: archive.deadlines ? { ...archive.deadlines } : {},
            stats: archive.stats ? { ...archive.stats } : null,
            completionSnapshot: archive.completionSnapshot ? { ...archive.completionSnapshot } : {},
            revealPairs: (archive.revealPairs || []).map((pair) => ({
                ...pair,
                member: cloneSimple(pair.member),
                angel: cloneSimple(pair.angel)
            }))
        })),
        archiveViewerDetail: state.roundState.archiveViewerDetail
            ? {
                ...state.roundState.archiveViewerDetail,
                godProfile: cloneSimple(state.roundState.archiveViewerDetail.godProfile),
                deadlines: state.roundState.archiveViewerDetail.deadlines ? { ...state.roundState.archiveViewerDetail.deadlines } : {},
                completionSnapshot: state.roundState.archiveViewerDetail.completionSnapshot ? { ...state.roundState.archiveViewerDetail.completionSnapshot } : {},
                revealMap: { ...(state.roundState.archiveViewerDetail.revealMap || {}) },
                members: (state.roundState.archiveViewerDetail.members || []).map((member) => ({ ...member })),
                posts: (state.roundState.archiveViewerDetail.posts || []).map((post) => ({
                    ...post,
                    images: [...(post.images || [])],
                    audioClips: [...(post.audioClips || [])],
                    comments: (post.comments || []).map((comment) => ({ ...comment }))
                })),
                revealPairs: (state.roundState.archiveViewerDetail.revealPairs || []).map((pair) => ({
                    ...pair,
                    member: cloneSimple(pair.member),
                    angel: cloneSimple(pair.angel)
                }))
            }
            : null,
        progress: { ...state.roundState.progress }
    },
    feedState: {
        ...state.feedState,
        likedPostIds: [...state.feedState.likedPostIds],
        items: state.feedState.items.map((post) => ({
            ...post,
            images: [...(post.images || [])],
            audioClips: [...(post.audioClips || [])],
            comments: (post.comments || []).map((comment) => ({ ...comment }))
        }))
    },
    composerState: {
        ...state.composerState,
        mentionTarget: cloneSimple(state.composerState.mentionTarget),
        proxyWishTarget: cloneSimple(state.composerState.proxyWishTarget),
        images: state.composerState.images.map((image) => ({ ...image })),
        audioDraft: cloneSimple(state.composerState.audioDraft)
    },
    overlayState: {
        comments: {
            ...state.overlayState.comments,
            likedCommentIds: [...state.overlayState.comments.likedCommentIds],
            replyTarget: cloneSimple(state.overlayState.comments.replyTarget),
            post: state.overlayState.comments.post
                ? {
                    ...state.overlayState.comments.post,
                    images: [...(state.overlayState.comments.post.images || [])],
                    audioClips: [...(state.overlayState.comments.post.audioClips || [])],
                    comments: (state.overlayState.comments.post.comments || []).map((comment) => ({ ...comment }))
                }
                : null
        },
        channelMenu: { ...state.overlayState.channelMenu },
        notificationCenter: { ...state.overlayState.notificationCenter },
        memberList: { ...state.overlayState.memberList },
        channelSettings: { ...state.overlayState.channelSettings },
        channelIntelligence: { ...state.overlayState.channelIntelligence },
        roundManagement: {
            ...state.overlayState.roundManagement,
            draftDeadlines: { ...(state.overlayState.roundManagement.draftDeadlines || {}) }
        },
        searchDialog: {
            ...state.overlayState.searchDialog,
            items: state.overlayState.searchDialog.items.map((item) => ({
                ...item,
                images: [...(item.images || [])],
                audioClips: [...(item.audioClips || [])],
                comments: (item.comments || []).map((comment) => ({ ...comment }))
            }))
        },
        imageLightbox: {
            ...state.overlayState.imageLightbox,
            image: cloneSimple(state.overlayState.imageLightbox.image)
        },
        deleteConfirm: { ...state.overlayState.deleteConfirm },
        identity: { ...state.overlayState.identity },
        authGate: { ...state.overlayState.authGate },
        toast: { ...state.overlayState.toast }
    },
    uiState: { ...state.uiState }
});
