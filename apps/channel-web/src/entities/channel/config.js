export const gameRoundTheme = "";

export const gameBoardStages = [
    {
        value: "wish",
        label: "许愿",
        taskLabel: "匿名发一个和本周主题相关的愿望",
        deadlineLabel: "周二 22:00 前完成",
        canCompose: true,
        forceAnonymous: true,
        requiresMention: false,
        submitLabel: "发布愿望",
        placeholder: "写下这周你最希望别人帮你完成的愿望...",
        helperText: "愿望尽量具体、可执行，别人接到后才更容易完成。"
    },
    {
        value: "claim",
        label: "选愿望",
        taskLabel: "从愿望列表里锁定 1 条你准备完成的愿望",
        deadlineLabel: "统一开启后每人只能选 1 个",
        canCompose: false,
        forceAnonymous: false,
        requiresMention: false,
        submitLabel: "当前不可发帖",
        placeholder: "",
        helperText: "这个阶段不发帖，直接从下方愿望列表里选 1 条作为你的本轮目标。"
    },
    {
        value: "delivery",
        label: "交付",
        taskLabel: "To 某位国王，提交你完成的愿望",
        deadlineLabel: "周六 18:00 前完成",
        canCompose: true,
        forceAnonymous: true,
        requiresMention: true,
        submitLabel: "提交交付",
        placeholder: "写下你这次为对方准备的内容，或者说明线下领取方式...",
        helperText: "交付阶段必须先选择 To 谁，确保国王知道这条内容是给自己的。"
    },
    {
        value: "guess",
        label: "猜测",
        taskLabel: "提交你对天使身份的猜测",
        deadlineLabel: "每人有限次数，猜完统一揭晓",
        canCompose: true,
        forceAnonymous: false,
        requiresMention: true,
        submitLabel: "提交猜测",
        placeholder: "写下你为什么猜是这个人，最好把线索和依据写清楚...",
        helperText: "先选你猜的是谁，再写判断依据。猜测不会匿名。"
    },
    {
        value: "reveal",
        label: "揭晓",
        taskLabel: "等待统一揭晓和本轮总结",
        deadlineLabel: "全员猜完后公布答案",
        canCompose: false,
        forceAnonymous: false,
        requiresMention: false,
        submitLabel: "当前不可发帖",
        placeholder: "",
        helperText: "揭晓阶段先看结果和回顾，这一轮发帖入口会暂时关闭。"
    }
];

export const gameBoardStageValues = gameBoardStages.map((stage) => stage.value);

export const defaultRoundDeadlines = Object.fromEntries(
    gameBoardStages.map((stage) => [stage.value, stage.deadlineLabel])
);

export const getRoundStageIndex = (stageValue) => gameBoardStageValues.indexOf(stageValue);

export const getNextRoundStage = (stageValue) => {
    const currentIndex = getRoundStageIndex(stageValue);
    if (currentIndex < 0 || currentIndex >= gameBoardStageValues.length - 1) {
        return null;
    }

    return gameBoardStageValues[currentIndex + 1];
};

export const channelBoardChoices = gameBoardStages.map((stage) => ({
    value: stage.value,
    label: stage.label
}));

export const boardTabs = [
    {
        value: "all",
        label: "全部"
    },
    ...channelBoardChoices
];

export const feedFilterChoices = [
    {
        value: "hot",
        label: "热门"
    },
    {
        value: "new-post",
        label: "新发表"
    },
    {
        value: "new-reply",
        label: "新回复"
    }
];

export const channelShellConfig = {
    brandName: "Soulmap",
    channelLogo: "https://lh3.googleusercontent.com/aida-public/AB6AXuDJUmmuvmt3jmrXR6sjC-XgIw7ZpGWHK2ClL0rFR7fWwCkwWqjrmHW39Py4Oi-W0kn2oYCMKoNVvH5vAdlhcYDzUfqmH67hsNpn2JEEuVJNKGnXMflYRLFqtaIpQdlJrUocYHAsapz8CAuaAK8kSS0EGaoQfWEx31DipdiQCFDAFw-1EVVf3XaU8tzBCxY_HmC9peicAbPCoNUtPvO-SwM7dKIClndraRoa0_3S5laPdFIz7G3On8LqOlZSEB-nMy5BSBAljxc7jIw",
    channelBadge: "品",
    memberCountLabel: "16 成员",
    primaryNavItems: [
        { icon: "home", label: "返回主页" }
    ],
    channelItems: []
};
