import { channelShellConfig, defaultRoundDeadlines } from "../entities/channel/config.js";
import { defaultAnonymousProfiles, mentionMembers } from "../entities/identity/config.js";

const nowIso = "2026-04-22T09:30:00.000Z";
const findMemberAvatar = (name) => mentionMembers.find((member) => member.name === name)?.avatar
    || defaultAnonymousProfiles[0]?.avatar
    || channelShellConfig.channelLogo;

export const demoUserIdentity = {
    id: "demo-identity",
    name: "试玩用户",
    avatar: defaultAnonymousProfiles[3]?.avatar || channelShellConfig.channelLogo,
    meta: "当前体验角色",
    role: "member"
};

export const demoRevealMap = {
    试玩用户: {
        member: {
            name: "试玩用户",
            avatar: demoUserIdentity.avatar
        },
        angel: {
            name: "瓜子",
            avatar: findMemberAvatar("瓜子")
        },
        updatedAt: nowIso
    },
    瓜子: {
        member: {
            name: "瓜子",
            avatar: findMemberAvatar("瓜子")
        },
        angel: {
            name: "咪咪",
            avatar: findMemberAvatar("咪咪")
        },
        updatedAt: nowIso
    }
};

export const demoChannel = {
    id: "demo-channel",
    slug: "demo",
    name: "品运一家人",
    description: "公开试玩模式",
    logoUrl: channelShellConfig.channelLogo,
    backgroundUrl: "",
    previewVisibility: "public",
    joinPolicy: "approval_required",
    currentRoundTheme: "玄学",
    currentRoundStage: "wish",
    currentRoundStatus: "active",
    currentRoundDeadlines: { ...defaultRoundDeadlines },
    currentRoundStartedAt: nowIso,
    currentRoundCompletedAt: null,
    currentRoundGodProfile: {
        name: "上帝",
        avatar: defaultAnonymousProfiles[2]?.avatar || channelShellConfig.channelLogo
    },
    currentRevealMap: demoRevealMap
};

export const demoAuth = {
    user: {
        id: "demo-user",
        email: "demo@soulmap.app"
    },
    isAnonymous: false
};

export const demoMembership = {
    status: "approved",
    joinRequest: null,
    reviewItems: [],
    role: "member"
};

export const demoMemberRuntime = {
    channel: demoChannel,
    realIdentity: demoUserIdentity,
    anonymousProfiles: defaultAnonymousProfiles.map((profile) => ({ ...profile })),
    activeAliasKey: defaultAnonymousProfiles[0]?.key || null,
    claimSelection: null,
    guessSelection: null
};

const createPost = ({
    id,
    board,
    authorName,
    authorAvatar,
    authorUserId,
    text,
    createdAt,
    timeLabel,
    isAnonymous = false,
    role = "member",
    adminRevealIdentity = null,
    comments = [],
    likes = 0,
    shares = 0
}) => ({
    id,
    board,
    authorName,
    authorAvatar,
    authorUserId,
    text,
    createdAt,
    timeLabel,
    dateLabel: createdAt,
    isAnonymous,
    isDeleted: false,
    deletedLabel: "",
    role,
    images: [],
    audioClips: [],
    comments,
    likes,
    shares,
    views: 0,
    aiDisclosure: "none",
    adminRevealIdentity
});

export const demoPosts = [
    createPost({
        id: "wish-1",
        board: "wish",
        authorName: "白榆",
        authorAvatar: defaultAnonymousProfiles[0].avatar,
        authorUserId: "wish-author-1",
        text: "有没有懂塔罗或者周易的家人帮我测测这个月的运势",
        createdAt: "2026-04-21T16:00:00.000Z",
        timeLabel: "17小时前",
        isAnonymous: true,
        adminRevealIdentity: {
            name: "章鱼烧",
            avatar: findMemberAvatar("章鱼烧")
        }
    }),
    createPost({
        id: "wish-2",
        board: "wish",
        authorName: "北桥",
        authorAvatar: defaultAnonymousProfiles[1].avatar,
        authorUserId: "wish-author-2",
        text: "想找一个愿意帮我看卧室风水摆位的人，最好能给我一个最小可执行版本",
        createdAt: "2026-04-21T14:30:00.000Z",
        timeLabel: "18小时前",
        isAnonymous: true,
        adminRevealIdentity: {
            name: "苹果",
            avatar: findMemberAvatar("苹果")
        }
    }),
    createPost({
        id: "wish-3",
        board: "wish",
        authorName: "海屿",
        authorAvatar: defaultAnonymousProfiles[2].avatar,
        authorUserId: "wish-author-3",
        text: "这周想重新理一下玄学学习路径，有没有人愿意帮我做一个入门目录",
        createdAt: "2026-04-21T13:10:00.000Z",
        timeLabel: "19小时前",
        isAnonymous: true,
        adminRevealIdentity: {
            name: "雯子",
            avatar: findMemberAvatar("雯子")
        }
    }),
    createPost({
        id: "delivery-1",
        board: "delivery",
        authorName: "云栖",
        authorAvatar: defaultAnonymousProfiles[3].avatar,
        authorUserId: "angel-1",
        text: "@试玩用户\n我给你抽到的是隐士。先别急着扩张，把问题缩到一个最小面，再去验证直觉。",
        createdAt: "2026-04-22T08:20:00.000Z",
        timeLabel: "1小时前",
        isAnonymous: true,
        adminRevealIdentity: {
            name: "瓜子",
            avatar: findMemberAvatar("瓜子")
        }
    }),
    createPost({
        id: "delivery-2",
        board: "delivery",
        authorName: "白榆",
        authorAvatar: defaultAnonymousProfiles[0].avatar,
        authorUserId: "angel-2",
        text: "@苹果\n我帮你整理了一份房间动线建议，先从床和书桌的相对位置改起。",
        createdAt: "2026-04-22T07:40:00.000Z",
        timeLabel: "2小时前",
        isAnonymous: true,
        adminRevealIdentity: {
            name: "海屿",
            avatar: findMemberAvatar("海屿")
        }
    }),
    createPost({
        id: "delivery-3",
        board: "delivery",
        authorName: "北桥",
        authorAvatar: defaultAnonymousProfiles[1].avatar,
        authorUserId: "angel-3",
        text: "@章鱼烧\n你上次提过的困惑，我按时间顺序给你拆成了三个判断节点。",
        createdAt: "2026-04-22T07:00:00.000Z",
        timeLabel: "2小时前",
        isAnonymous: true,
        adminRevealIdentity: {
            name: "咪咪",
            avatar: findMemberAvatar("咪咪")
        }
    }),
    createPost({
        id: "guess-1",
        board: "guess",
        authorName: "章鱼烧",
        authorAvatar: findMemberAvatar("章鱼烧"),
        authorUserId: "member-1",
        text: "@海屿\n我猜你是海屿，因为你会把建议拆成很具体的执行节点。",
        createdAt: "2026-04-22T09:00:00.000Z",
        timeLabel: "30分钟前",
        comments: []
    }),
    createPost({
        id: "guess-2",
        board: "guess",
        authorName: "苹果",
        authorAvatar: findMemberAvatar("苹果"),
        authorUserId: "member-2",
        text: "@咪咪\n我猜你是咪咪，语气很像你平时发长消息时的节奏。",
        createdAt: "2026-04-22T08:50:00.000Z",
        timeLabel: "40分钟前",
        comments: []
    })
];

export const cloneDemoPost = (post) => ({
    ...post,
    roundArchive: post.roundArchive ? JSON.parse(JSON.stringify(post.roundArchive)) : null,
    images: (post.images || []).map((image) => ({ ...image })),
    audioClips: (post.audioClips || []).map((clip) => ({ ...clip })),
    comments: (post.comments || []).map((comment) => ({ ...comment }))
});

export const cloneDemoChannel = () => ({
    ...demoChannel,
    currentRoundGodProfile: demoChannel.currentRoundGodProfile ? { ...demoChannel.currentRoundGodProfile } : null,
    currentRevealMap: JSON.parse(JSON.stringify(demoRevealMap))
});

export const cloneDemoBootstrap = () => ({
    channel: cloneDemoChannel(),
    auth: {
        user: { ...demoAuth.user },
        isAnonymous: false
    },
    membership: {
        ...demoMembership,
        reviewItems: []
    },
    memberRuntime: {
        channel: cloneDemoChannel(),
        realIdentity: { ...demoUserIdentity },
        anonymousProfiles: demoMemberRuntime.anonymousProfiles.map((profile) => ({ ...profile })),
        activeAliasKey: demoMemberRuntime.activeAliasKey,
        claimSelection: null,
        guessSelection: null
    }
});
