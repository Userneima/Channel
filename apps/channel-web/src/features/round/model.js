import { defaultRoundDeadlines, gameBoardStages } from "../../entities/channel/config.js";
import { mentionMembers } from "../../entities/identity/config.js";
import { getPostPreviewText } from "../../shared/lib/helpers.js";

const stageByValue = new Map(gameBoardStages.map((stage) => [stage.value, stage]));

export const getRoundStage = (value) => stageByValue.get(String(value || "").trim()) || gameBoardStages[0];

export const extractRevealTargetName = (body) => {
    const firstLine = String(body || "").split(/\r?\n/, 1)[0]?.trim() || "";
    if (!firstLine.startsWith("@")) {
        return "";
    }

    return firstLine.slice(1).trim();
};

export const buildRevealPairs = (revealMap) => Object.values(revealMap || {})
    .filter((entry) => entry?.member?.name && entry?.angel?.name)
    .map((entry) => ({
        member: entry.member,
        angel: entry.angel,
        wishPostId: entry.wishPostId || null,
        wishPreview: String(entry.wishPreview || "").trim(),
        guessedAngelName: String(entry.guessedAngelName || "").trim(),
        guessedAngelAvatar: String(entry.guessedAngelAvatar || "").trim(),
        updatedAt: entry.updatedAt || null
    }))
    .sort((left, right) => left.member.name.localeCompare(right.member.name, "zh-Hans-CN"));

export const buildRevealResult = ({ revealMap, memberName, guessSelection = null }) => {
    const revealEntry = revealMap?.[memberName] || null;
    if (!revealEntry?.angel?.name) {
        return null;
    }

    const guessedName = revealEntry.guessedAngelName || guessSelection?.name || "";
    return {
        guessedName,
        guessedAvatar: revealEntry.guessedAngelAvatar || guessSelection?.avatar || "",
        actualName: revealEntry.angel.name,
        actualAvatar: revealEntry.angel.avatar || "",
        isCorrect: Boolean(guessedName) && guessedName === revealEntry.angel.name
    };
};

export const buildGuessByMemberName = (selections) => {
    const guessByMemberName = new Map();

    (selections || []).forEach((selection) => {
        const memberName = String(selection?.memberName || "").trim();
        if (!memberName) {
            return;
        }

        guessByMemberName.set(memberName, {
            guessedAngelName: String(selection?.guessedAngelName || "").trim(),
            guessedAngelAvatar: String(selection?.guessedAngelAvatar || "").trim()
        });
    });

    return guessByMemberName;
};

export const buildWishPreviewByMemberName = (posts) => {
    const previewByMemberName = new Map();
    const orderedPosts = [...(posts || [])]
        .filter((post) => post && !post.isDeleted && post.board === "wish")
        .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0));

    orderedPosts.forEach((post) => {
        const memberName = String(post.authorName || "").trim();
        if (!memberName || previewByMemberName.has(memberName)) {
            return;
        }

        previewByMemberName.set(memberName, {
            wishPostId: post.id,
            wishPreview: getPostPreviewText(post, 88).text || ""
        });
    });

    return previewByMemberName;
};

export const attachWishPreviewToRevealMap = (revealMap, wishPreviewByMemberName) => Object.fromEntries(
    Object.entries(revealMap || {}).map(([memberName, entry]) => {
        const wishData = wishPreviewByMemberName.get(memberName);
        return [
            memberName,
            {
                ...entry,
                wishPostId: wishData?.wishPostId || entry?.wishPostId || null,
                wishPreview: wishData?.wishPreview || entry?.wishPreview || ""
            }
        ];
    })
);

export const attachGuessToRevealMap = (revealMap, guessByMemberName) => Object.fromEntries(
    Object.entries(revealMap || {}).map(([memberName, entry]) => {
        const guessData = guessByMemberName.get(memberName);
        return [
            memberName,
            {
                ...entry,
                guessedAngelName: guessData?.guessedAngelName || entry?.guessedAngelName || "",
                guessedAngelAvatar: guessData?.guessedAngelAvatar || entry?.guessedAngelAvatar || ""
            }
        ];
    })
);

const buildRevealAvatarMap = ({ realIdentity, mentionOptions = mentionMembers }) => {
    const avatarByName = new Map(
        mentionOptions.map((member) => [String(member.name || "").trim(), String(member.avatar || "").trim()])
    );
    const realName = String(realIdentity?.name || "").trim();
    if (realName) {
        avatarByName.set(realName, String(realIdentity?.avatar || "").trim());
    }
    return avatarByName;
};

export const buildRevealMapFromDeliveryPosts = (posts, { realIdentity, mentionOptions = mentionMembers } = {}) => {
    const avatarByName = buildRevealAvatarMap({ realIdentity, mentionOptions });
    const nextRevealMap = {};
    const orderedPosts = [...(posts || [])]
        .filter((post) => post && !post.isDeleted && post.board === "delivery")
        .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0));

    orderedPosts.forEach((post) => {
        const memberName = String(post.deliveryMeta?.targetMemberName || extractRevealTargetName(post.text)).trim();
        const angelName = String(post.adminRevealIdentity?.name || "").trim();
        if (!memberName || !angelName || memberName === angelName || nextRevealMap[memberName]) {
            return;
        }

        nextRevealMap[memberName] = {
            member: {
                name: memberName,
                avatar: String(post.deliveryMeta?.targetMemberAvatar || avatarByName.get(memberName) || "").trim()
            },
            angel: {
                name: angelName,
                avatar: String(post.adminRevealIdentity?.avatar || avatarByName.get(angelName) || "").trim()
            },
            wishPostId: post.deliveryMeta?.wishPostId || null,
            updatedAt: new Date().toISOString()
        };
    });

    return nextRevealMap;
};

export const buildRoundCompletionSummary = (memberStatuses = []) => {
    const totalMembers = memberStatuses.length;
    const countBy = (key) => memberStatuses.filter((item) => Boolean(item[key])).length;

    return {
        totalMembers,
        wishDone: countBy("wishSubmitted"),
        claimDone: countBy("claimSelected"),
        deliveryDone: countBy("deliverySubmitted"),
        guessDone: countBy("guessSubmitted"),
        revealDone: countBy("revealReady"),
        readyForClaim: totalMembers > 0 && memberStatuses.every((item) => item.wishSubmitted),
        readyForDelivery: totalMembers > 0 && memberStatuses.every((item) => item.claimSelected),
        readyForGuess: totalMembers > 0 && memberStatuses.every((item) => item.deliverySubmitted),
        readyForReveal: totalMembers > 0 && memberStatuses.every((item) => item.deliverySubmitted && item.guessSubmitted)
    };
};

export const buildRoundSummary = (memberStatuses = []) => {
    const completion = buildRoundCompletionSummary(memberStatuses);
    const missingNames = (key) => memberStatuses.filter((item) => !item[key]).map((item) => item.name);

    return {
        ...completion,
        missingWishNames: missingNames("wishSubmitted"),
        missingClaimNames: missingNames("claimSelected"),
        missingDeliveryNames: missingNames("deliverySubmitted"),
        missingGuessNames: missingNames("guessSubmitted"),
        missingRevealNames: missingNames("revealReady")
    };
};

export const buildCurrentStageProgress = (stageValue, summary) => {
    if (stageValue === "wish") {
        return `${summary.wishDone}/${summary.totalMembers || 0}`;
    }
    if (stageValue === "claim") {
        return `${summary.claimDone}/${summary.totalMembers || 0}`;
    }
    if (stageValue === "delivery") {
        return `${summary.deliveryDone}/${summary.totalMembers || 0}`;
    }
    if (stageValue === "guess") {
        return `${summary.guessDone}/${summary.totalMembers || 0}`;
    }

    return `${summary.revealDone}/${summary.totalMembers || 0}`;
};

export const buildMemberTask = ({ isApproved, currentStage, currentMemberStatus }) => {
    if (!isApproved) {
        return {
            status: "公开浏览",
            title: `${currentStage.label}阶段`,
            meta: "登录后进入频道，系统会直接告诉你当前该做什么。",
            hint: currentStage.helperText
        };
    }

    if (!currentMemberStatus) {
        return {
            status: "待同步",
            title: `${currentStage.label}阶段`,
            meta: "你的本轮状态正在同步。",
            hint: currentStage.helperText
        };
    }

    if (currentStage.value === "wish") {
        return currentMemberStatus.wishSubmitted
            ? {
                status: "已完成",
                title: "你已经完成本轮许愿",
                meta: "系统已记录你的匿名愿望，等待管理员切到选愿望阶段。",
                hint: currentStage.helperText
            }
            : {
                status: "待完成",
                title: "先发 1 条匿名愿望",
                meta: "愿望发出后，这一阶段就算完成。",
                hint: currentStage.helperText
            };
    }

    if (currentStage.value === "claim") {
        if (currentMemberStatus.claimSelected) {
            return {
                status: "已完成",
                title: `你当前锁定的是 ${currentMemberStatus.claimTargetName || "1 条愿望"}`,
                meta: "交付阶段会自动带上这位国王作为 To 对象。",
                hint: currentStage.helperText
            };
        }

        return {
            status: "待完成",
            title: "从愿望列表里锁定 1 条你要完成的愿望",
            meta: "没有锁定目标的话，交付阶段会被卡住。",
            hint: currentStage.helperText
        };
    }

    if (currentStage.value === "delivery") {
        if (currentMemberStatus.deliverySubmitted) {
            return {
                status: "已完成",
                title: `你已经向 ${currentMemberStatus.deliveryTargetName || "对应国王"} 提交了交付`,
                meta: "现在等待管理员推进到猜测阶段。",
                hint: currentStage.helperText
            };
        }

        if (!currentMemberStatus.claimSelected) {
            return {
                status: "已卡住",
                title: "你还没有锁定愿望",
                meta: "当前没有交付目标，需要管理员处理异常或回退阶段。",
                hint: "没有锁定愿望就无法形成有效交付。"
            };
        }

        return {
            status: "待完成",
            title: `向 ${currentMemberStatus.claimTargetName || "对应国王"} 提交交付`,
            meta: "交付时会自动绑定你当前认领的愿望和目标成员。",
            hint: currentStage.helperText
        };
    }

    if (currentStage.value === "guess") {
        return currentMemberStatus.guessSubmitted
            ? {
                status: "已完成",
                title: `你已提交对 ${currentMemberStatus.guessedAngelName || "天使"} 的猜测`,
                meta: "本轮猜测已经锁定，等待管理员统一揭晓。",
                hint: currentStage.helperText
            }
            : {
                status: "待完成",
                title: "提交你对天使身份的猜测",
                meta: "不提交猜测，本轮就无法进入正式揭晓。",
                hint: currentStage.helperText
            };
    }

    return currentMemberStatus.revealReady
        ? {
            status: "已揭晓",
            title: `你的天使是 ${currentMemberStatus.revealedAngelName || "已揭晓"}`,
            meta: currentMemberStatus.guessedCorrectly ? "这轮你猜中了。" : "这轮没猜中，可以回看整轮结果。",
            hint: currentStage.helperText
        }
        : {
            status: "等待揭晓",
            title: "管理员还没完成本轮揭晓",
            meta: "揭晓结果生成后，这里会直接显示。",
            hint: currentStage.helperText
        };
};

export const buildRoundMemberOptions = ({
    realIdentity,
    memberStatuses = [],
    feedItems = [],
    revealMap = {},
    mentionOptions = mentionMembers
}) => {
    const memberMap = new Map();
    const addMember = (member) => {
        const name = String(member?.name || member?.authorName || "").trim();
        if (!name || memberMap.has(name)) {
            return;
        }

        memberMap.set(name, {
            name,
            avatar: String(member?.avatar || member?.authorAvatar || "").trim(),
            userId: member?.userId || member?.authorUserId || null,
            identityId: member?.identityId || null
        });
    };

    addMember({
        name: realIdentity?.name,
        avatar: realIdentity?.avatar
    });
    mentionOptions.forEach(addMember);
    memberStatuses.forEach(addMember);
    feedItems.forEach((post) => {
        if (!post?.isAnonymous) {
            addMember({
                name: post.authorName,
                avatar: post.authorAvatar
            });
        }
    });
    Object.values(revealMap || {}).forEach((entry) => {
        addMember(entry?.member);
        addMember(entry?.angel);
    });

    return [...memberMap.values()];
};

export const buildChannelMemberOptions = (state, options = {}) => {
    const { excludeCurrent = false } = options;
    const includeFallbackMembers = state.runtimeState.channel?.slug === "demo"
        || state.membershipState.status !== "approved";
    const members = buildRoundMemberOptions({
        realIdentity: state.runtimeState.realIdentity,
        memberStatuses: state.roundState.memberStatuses,
        feedItems: state.feedState.items,
        revealMap: state.roundState.revealMap,
        mentionOptions: includeFallbackMembers ? mentionMembers : []
    });

    if (!excludeCurrent) {
        return members;
    }

    const currentName = String(state.runtimeState.realIdentity.name || "").trim();
    return members.filter((member) => String(member.name || "").trim() !== currentName);
};

export const findCurrentMemberStatus = (state) => {
    const memberStatuses = state.roundState.memberStatuses || [];
    return memberStatuses.find((item) => item.identityId === state.runtimeState.realIdentity.id)
        || memberStatuses.find((item) => item.name === state.runtimeState.realIdentity.name)
        || null;
};

export const getRoundDeadlinesForSave = (state) => ({
    ...Object.fromEntries(
        Object.entries(defaultRoundDeadlines).map(([stage, label]) => [
            stage,
            state.roundState.deadlines?.[stage] && typeof state.roundState.deadlines[stage] === "object"
                ? {
                    ...state.roundState.deadlines[stage]
                }
                : {
                    label,
                    deadlineAt: null
                }
        ])
    ),
    ...Object.fromEntries(
        Object.entries(state.overlayState.roundManagement?.draftDeadlines || {}).map(([stage, draftValue]) => [
            stage,
            draftValue && typeof draftValue === "object"
                ? {
                    ...draftValue
                }
                : {
                    ...(state.roundState.deadlines?.[stage] || { label: defaultRoundDeadlines[stage] || "", deadlineAt: null }),
                    label: String(draftValue || "").trim() || defaultRoundDeadlines[stage] || ""
                }
        ])
    )
});
