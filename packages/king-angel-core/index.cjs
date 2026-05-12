const STAGE_ORDER = ["wish", "claim", "delivery", "guess", "reveal"];

const STAGES = [
    {
        value: "wish",
        label: "许愿",
        taskLabel: "匿名发一个和本轮主题相关的愿望",
        canCompose: true,
        forceAnonymous: true,
        requiresTarget: false,
        submitLabel: "发布愿望",
        placeholder: "写下这轮你希望天使帮你完成的愿望...",
        helperText: "愿望要具体、可执行，天使接到后才更容易完成。"
    },
    {
        value: "claim",
        label: "认领",
        taskLabel: "从愿望列表里认领 1 条你准备完成的愿望",
        canCompose: false,
        forceAnonymous: false,
        requiresTarget: false,
        submitLabel: "认领愿望",
        placeholder: "",
        helperText: "每位天使只能认领 1 个国王的愿望，不能认领自己的愿望。"
    },
    {
        value: "delivery",
        label: "交付",
        taskLabel: "匿名向国王交付你完成的愿望",
        canCompose: true,
        forceAnonymous: true,
        requiresTarget: true,
        submitLabel: "提交交付",
        placeholder: "写下你为国王准备的内容，或说明线下领取方式...",
        helperText: "交付会匿名展示给国王，但后台仍会保存真实身份用于最终揭晓。"
    },
    {
        value: "guess",
        label: "猜测",
        taskLabel: "提交你对天使身份的猜测",
        canCompose: true,
        forceAnonymous: false,
        requiresTarget: true,
        submitLabel: "提交猜测",
        placeholder: "写下你猜测的天使和判断依据...",
        helperText: "猜测不匿名，最终揭晓时会显示猜测是否正确。"
    },
    {
        value: "reveal",
        label: "揭晓",
        taskLabel: "查看国王与天使配对结果",
        canCompose: false,
        forceAnonymous: false,
        requiresTarget: false,
        submitLabel: "查看结果",
        placeholder: "",
        helperText: "这一阶段不再提交内容，只查看最终配对和回顾。"
    }
];

const ROLE_LABELS = {
    owner: "创建者",
    admin: "管理员",
    member: "成员",
    guest: "访客"
};

const ERROR_CODES = {
    unauthorized: "unauthorized",
    forbidden: "forbidden",
    notFound: "not_found",
    stageLocked: "stage_locked",
    alreadySubmitted: "already_submitted",
    invalidPayload: "invalid_payload"
};

const stageByValue = new Map(STAGES.map((stage) => [stage.value, stage]));

const normalizeStage = (stageValue) => (stageByValue.has(stageValue) ? stageValue : "wish");

const getStage = (stageValue) => stageByValue.get(normalizeStage(stageValue));

const getStageIndex = (stageValue) => STAGE_ORDER.indexOf(normalizeStage(stageValue));

const getNextStage = (stageValue) => {
    const index = getStageIndex(stageValue);
    return index >= 0 && index < STAGE_ORDER.length - 1 ? STAGE_ORDER[index + 1] : null;
};

const canManageGame = (role) => role === "owner" || role === "admin";

const canAdvanceStage = canManageGame;

const canSeeMemberDirectory = (role) => role === "owner" || role === "admin" || role === "member";

const canEditGameSettings = canManageGame;

const canSubmitForStage = (stageValue, memberStatus = {}) => {
    const stage = normalizeStage(stageValue);
    if (stage === "wish") {
        return !memberStatus.wishSubmitted;
    }
    if (stage === "claim") {
        return !memberStatus.claimSelected;
    }
    if (stage === "delivery") {
        return Boolean(memberStatus.claimSelected) && !memberStatus.deliverySubmitted;
    }
    if (stage === "guess") {
        return !memberStatus.guessSubmitted;
    }
    return false;
};

const getBlockedReason = (stageValue, memberStatus = {}) => {
    const stage = normalizeStage(stageValue);
    if (canSubmitForStage(stage, memberStatus)) {
        return "";
    }
    if (stage === "delivery" && !memberStatus.claimSelected) {
        return "需要先认领一个愿望。";
    }
    if (stage === "reveal") {
        return "揭晓阶段不再提交内容。";
    }
    return "你已经完成当前阶段。";
};

const buildMemberTask = ({ stageValue, memberStatus = {}, role = "guest" } = {}) => {
    const stage = getStage(stageValue);
    if (role === "guest") {
        return {
            status: "未加入",
            title: `${stage.label}阶段`,
            meta: "加入游戏后才能看到自己的任务。",
            canSubmit: false,
            blockedReason: "请先加入游戏。"
        };
    }

    return {
        status: canSubmitForStage(stage.value, memberStatus) ? "待完成" : "已同步",
        title: stage.taskLabel,
        meta: stage.helperText,
        canSubmit: canSubmitForStage(stage.value, memberStatus),
        blockedReason: getBlockedReason(stage.value, memberStatus)
    };
};

const normalizeError = (error) => {
    if (!error) {
        return { code: ERROR_CODES.invalidPayload, message: "请求失败。" };
    }
    if (typeof error === "string") {
        return { code: ERROR_CODES.invalidPayload, message: error };
    }
    return {
        code: error.code || ERROR_CODES.invalidPayload,
        message: error.message || "请求失败。",
        detail: error.detail || null
    };
};

module.exports = {
    STAGE_ORDER,
    STAGES,
    ROLE_LABELS,
    ERROR_CODES,
    normalizeStage,
    getStage,
    getStageIndex,
    getNextStage,
    canManageGame,
    canAdvanceStage,
    canSeeMemberDirectory,
    canEditGameSettings,
    canSubmitForStage,
    getBlockedReason,
    buildMemberTask,
    normalizeError
};
