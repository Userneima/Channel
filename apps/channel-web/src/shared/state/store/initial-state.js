import { gameRoundTheme } from "../../../entities/channel/config.js";
import { defaultAnonymousProfiles, defaultRealIdentity } from "../../../entities/identity/config.js";
import { firstAliasKey, firstBoard, firstFilter } from "./helpers.js";

export const createInitialState = () => ({
    runtimeState: {
        status: "idle",
        phase: "idle",
        hydrationSource: "runtime-config",
        blockingError: null,
        channel: null,
        realIdentity: { ...defaultRealIdentity },
        anonymousProfiles: defaultAnonymousProfiles.map((profile) => ({ ...profile })),
        activeAliasKey: firstAliasKey
    },
    authState: {
        status: "unknown",
        user: null,
        isAnonymous: false,
        displayName: "",
        email: "",
        password: "",
        error: null
    },
    membershipState: {
        status: "unknown",
        joinRequest: null,
        reviewItems: [],
        reviewStatus: "idle",
        directoryItems: [],
        directoryStatus: "idle",
        directoryError: null,
        mutationStatus: "idle",
        activeMemberId: null,
        submitStatus: "idle",
        draftMessage: "",
        error: null
    },
    channelCreateState: {
        name: "",
        description: "",
        status: "idle",
        error: null
    },
    roundState: {
        currentRoundId: null,
        lifecycleStatus: "active",
        archiveMode: null,
        defaultTitle: "",
        theme: gameRoundTheme,
        activeStage: "wish",
        status: "active",
        deadlines: {},
        startedAt: null,
        completedAt: null,
        forceArchiveReason: "",
        completionSnapshot: {},
        sourceRoundId: null,
        viewOnlyReason: null,
        claimSelection: null,
        guessSelection: null,
        guessExcludedNames: [],
        revealMap: {},
        godProfile: null,
        memberStatuses: [],
        archives: [],
        archiveViewerRoundId: null,
        archiveViewerDetail: null,
        progress: {
            wishSubmitted: false,
            claimSelected: false,
            deliverySubmitted: false,
            guessSubmitted: false
        }
    },
    feedState: {
        status: "idle",
        items: [],
        error: null,
        activeBoard: firstBoard,
        activeFilter: firstFilter,
        searchQuery: "",
        likedPostIds: []
    },
    composerState: {
        expanded: false,
        draftText: "",
        images: [],
        nextImageId: 1,
        audioDraft: null,
        nextAudioId: 1,
        audioRecording: false,
        mentionTarget: null,
        proxyWishTarget: null,
        aiDisclosure: "none",
        board: "none",
        anonymousMode: false,
        anonymousTextRewrite: false,
        anonymousPreviewStatus: "idle",
        anonymousPreviewText: "",
        anonymousPreviewSourceText: "",
        aiImageReshape: false,
        submitStatus: "idle",
        error: null,
        mentionOpen: false,
        proxyWishOpen: false,
        aiDisclosureOpen: false,
        boardOpen: false
    },
    overlayState: {
        comments: {
            open: false,
            postId: null,
            openSource: "comments",
            post: null,
            status: "idle",
            error: null,
            sort: "hot",
            likedCommentIds: [],
            replyTarget: null,
            draftText: "",
            anonymousMode: false,
            submitStatus: "idle",
            initialFocusTarget: null
        },
        channelMenu: {
            open: false,
            anchorX: null,
            anchorY: null,
            anchorSource: ""
        },
        notificationCenter: {
            open: false,
            tab: "interaction",
            anchorX: null,
            anchorY: null,
            anchorSource: ""
        },
        memberList: {
            open: false,
            mode: "view",
            pendingRemoveIdentityId: null
        },
        channelSettings: {
            open: false,
            draftName: "",
            draftLogo: "",
            draftBackground: "",
            saveStatus: "idle",
            error: null
        },
        channelIntelligence: {
            open: false,
            selectedArchiveId: null,
            archiveDetailOpen: false
        },
        roundManagement: {
            open: false,
            godPickerOpen: false,
            themeEditorOpen: false,
            deadlineEditorOpen: false,
            revealEditorOpen: false,
            revealMemberPickerOpen: false,
            revealAngelPickerOpen: false,
            draftRevealMember: null,
            draftRevealAngel: null,
            draftTheme: "",
            draftDeadlines: {}
        },
        searchDialog: {
            open: false,
            status: "idle",
            error: null,
            query: "",
            sort: "relevant",
            board: "all",
            items: []
        },
        registeredUsers: {
            open: false,
            status: "idle",
            error: null,
            items: []
        },
        imageLightbox: {
            open: false,
            image: null,
            source: ""
        },
        deleteConfirm: {
            open: false,
            targetType: "",
            targetId: null,
            postId: null,
            title: "",
            message: "",
            scopeLabel: "",
            submitStatus: "idle",
            error: null
        },
        identity: {
            open: false,
            draftName: defaultRealIdentity.name,
            draftAvatar: defaultRealIdentity.avatar,
            saveStatus: "idle",
            error: null
        },
        authGate: {
            open: false,
            mode: "login"
        },
        toast: {
            visible: false,
            tone: "info",
            message: ""
        }
    },
    uiState: {
        sidebarOpen: false,
        topRegion: "expanded",
        accountMenuOpen: false,
        searchFocusNonce: 0,
        adminRevealAnonymous: false
    }
});
