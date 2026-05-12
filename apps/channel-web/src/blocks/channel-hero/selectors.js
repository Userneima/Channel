import { channelShellConfig } from "../../entities/channel/config.js";
import { buildChannelMemberOptions } from "../../features/round/model.js";

const getChannelHeroStyle = (channel) => {
    const backgroundUrl = String(channel?.backgroundUrl || "").trim();
    if (!backgroundUrl) {
        return "";
    }

    return `--channel-hero-image:url("${backgroundUrl.replace(/"/g, "%22")}");`;
};

export const selectChannelHeroVM = (state) => ({
    channelName: state.runtimeState.channel?.name || "频道初始化中",
    memberCountLabel: `${buildChannelMemberOptions(state).length} 成员`,
    logoUrl: state.runtimeState.channel?.logoUrl || channelShellConfig.channelLogo,
    heroStyle: getChannelHeroStyle(state.runtimeState.channel),
    identityName: state.runtimeState.realIdentity.name
});
