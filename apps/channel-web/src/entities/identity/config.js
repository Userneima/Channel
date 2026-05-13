export const defaultRealIdentity = {
    id: null,
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuAdn4SXXvi49UKFKBuOYSU69PaV_4engMSiIUkQpcH9Dq-zjinv9rRqNzjFK-_KuzU2Gr6HOfI2OZ-01V7rzVGIWaSyOPbg9Q5rsFMfV-JXcD32yqlps9leknFzregRkqtJVBZWeZ3TJKaExBlvUeO_2F-5IORdrpgxMw4eRaXxtuOmsn0ulMBWYOK6FZtBAis0lvg3BKhmbjcDhTRygvyVEKb6zY2afnZACw8KV6nqOp9MLhO7nLBMaFoVtMhyjFLpOuFQrJB8wuI",
    name: "当前账号",
    meta: "当前真实身份",
    role: null
};

export const defaultAnonymousProfiles = [
    {
        key: "slot-baiyu",
        name: "白榆",
        avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuAAF1xIAURg4pscz_NBpuuG-SxRtXMwz7Bj6kZwsrWNFW-odFm30orXRucNJOPwamQYgZR1TEIhZkL5O10eQJtvrDM8t822PyG2dKeoOvKHYsw6ZeMXaQUv-mcoKFb2ir32XD-DN4ZbVpW9SN4fPdJet1EmrS2L2uG_zqMTRQUXqC6d13nTjeInGSZrwvkq2IMSe99646zSnQdupaTxFNMC0rzDB4UquXVWmFsLO4Ial8RT0DgamryGslxLm-1OIJTEdDTRdHXJjC4"
    },
    {
        key: "slot-beiqiao",
        name: "北桥",
        avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCcKwUvE26sD93HXFPeaZKG4rcO46TtVUuH82BX4ziwxtQO6LqUqi7htZJg5ldPwrXuMlk-2HE9PBqh4V3ripA5SFIRoJzC1z5TUHOahBodZdJ6nyPtbI3ueAl8kH5khm1HV62UVFoUCxs9G6GCSfF6BwWaSCx8Mo7j_89w8D_bdtvADDehJLb4t9gCgUFtvyQYlkfWhwEvSG3zS91PnAoiMUsN4C6EDpZP2lxYDUwhc8vX9KFUg80eEZgmyLjAUr2k7jQ0cGijT-A"
    },
    {
        key: "slot-haiyu",
        name: "海屿",
        avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuD7dADvgkUZTmxeXdVrXRGz76Ic6R6Wd6I4KZ1sPj4qgDDug3FSXbt2MHfAjLymGrdxs1loOM-lwzNDWfpjTfON7UuMTrWPl053BjvRGm_VZdQLUtD9KvLKwjz03l_X740oiKoRp8XGKaK_swULjXNS4iVPZr2Oult7W_RibE_RDDkx_dg75u32hmhdVNzVPyVRbrBVe9bJt0Utq1RZTnetWnhQFsWzK7GZYVWtLQsMrGURY_piyy7q5wJq2TUz2sc2IWSw6UTn2wE"
    },
    {
        key: "slot-yunqi",
        name: "云栖",
        avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuAMEcp_Gb2H95x3OK1WiHC-EzuWE003ywUAtg9SEVazxij0OCuoZ50_DrAn602n1xUaJmFqPITtx0LAknqLJzjQz9eO6w6a9Ak9r77Qp9_EzQPiKdoNVrvoQ1LaimRB6o8UOT5Q_WRzhrKcmgvZYNePZUUiORLaFawGrWHI_8yS8gqV-JuBxX9sDrx2FEr1gcRL1qlAoW9oXheuh309Vm9ygZmwKzVA8_iJS66DcBDj1vo1aetR7EVQKdABFPiEu_vlhKfkrn0ArYk"
    }
];

export const mentionMembers = [
    {
        name: "雯子",
        avatar: defaultAnonymousProfiles[0].avatar
    },
    {
        name: "咪咪",
        avatar: defaultAnonymousProfiles[1].avatar
    },
    {
        name: "想想",
        avatar: defaultAnonymousProfiles[2].avatar
    },
    {
        name: "苹果",
        avatar: defaultAnonymousProfiles[3].avatar
    },
    {
        name: "章鱼烧",
        avatar: defaultAnonymousProfiles[0].avatar
    },
    {
        name: "小乌龟",
        avatar: defaultAnonymousProfiles[1].avatar
    },
    {
        name: "健",
        avatar: defaultAnonymousProfiles[2].avatar
    },
    {
        name: "鱼",
        avatar: defaultAnonymousProfiles[3].avatar
    },
    {
        name: "饼干",
        avatar: defaultAnonymousProfiles[0].avatar
    },
    {
        name: "kk",
        avatar: defaultAnonymousProfiles[1].avatar
    },
    {
        name: "阿豹",
        avatar: defaultAnonymousProfiles[2].avatar
    },
    {
        name: "Trytry",
        avatar: defaultAnonymousProfiles[3].avatar
    },
    {
        name: "瓜子",
        avatar: defaultAnonymousProfiles[0].avatar
    }
];

export const composerIdentityPresets = {
    defaultPlaceholder: "期待你的分享...",
    anonymousPlaceholder: "输入原意，AI 会帮你匿名改写"
};

export const createAliasTemplates = (profiles) => profiles.map((profile, index) => ({
    slotKey: profile.key || `slot-${index + 1}`,
    displayName: profile.name,
    avatarUrl: profile.avatar
}));
