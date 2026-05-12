import { channelShellConfig } from "../../entities/channel/config.js";

const getChannelHeroStyle = (channel) => {
    const backgroundUrl = String(channel?.backgroundUrl || "").trim();
    if (!backgroundUrl) {
        return "";
    }

    return `--channel-hero-image:url("${backgroundUrl.replace(/"/g, "%22")}");`;
};

const getMemberCount = (state) => {
    const activeIdentityIds = new Set();
    const activeUserIds = new Set();

    (state.membershipState.directoryItems || []).forEach((member) => {
        if (member?.identityId) {
            activeIdentityIds.add(member.identityId);
        }
        if (member?.userId) {
            activeUserIds.add(member.userId);
        }
    });

    (state.roundState.memberStatuses || []).forEach((member) => {
        if (member?.identityId) {
            activeIdentityIds.add(member.identityId);
        }
        if (member?.userId) {
            activeUserIds.add(member.userId);
        }
    });

    if (activeUserIds.size > 0) {
        return activeUserIds.size;
    }

    if (activeIdentityIds.size > 0) {
        return activeIdentityIds.size;
    }

    return state.membershipState.status === "approved" ? 1 : 0;
};

export const selectChannelHeroVM = (state) => ({
    channelName: state.runtimeState.channel?.name || "频道初始化中",
    memberCountLabel: `${getMemberCount(state)} 成员`,
    logoUrl: state.runtimeState.channel?.logoUrl || channelShellConfig.channelLogo,
    heroStyle: getChannelHeroStyle(state.runtimeState.channel),
    identityName: state.runtimeState.realIdentity.name
});
