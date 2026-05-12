import { createAuthSessionApi } from "./auth-session.js";
import { createCacheApi } from "./cache.js";
import { createChannelBootstrapApi } from "./channel-bootstrap.js";
import { createChannelDataServiceContext } from "../../../../data-service-support/core.js";
import { createFeedPostsCommentsApi } from "./feed-posts-comments.js";
import { createIdentityAliasApi } from "./identity-alias.js";
import { createMembershipApi } from "./membership.js";
import { createRoundApi } from "./round.js";

export const createChannelDataService = () => {
    const context = createChannelDataServiceContext();
    const api = {
        ...createAuthSessionApi(context),
        ...createCacheApi(context),
        ...createChannelBootstrapApi(context),
        ...createMembershipApi(context),
        ...createFeedPostsCommentsApi(context),
        ...createIdentityAliasApi(context),
        ...createRoundApi(context)
    };

    context.api = api;
    return api;
};

export const channelDataService = createChannelDataService();
