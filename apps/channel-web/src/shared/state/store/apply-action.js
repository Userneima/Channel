import { applyAuthActions } from "./auth.js";
import { applyChannelCreateActions } from "./channel-create.js";
import { applyComposerActions } from "./composer.js";
import { applyFeedActions } from "./feed.js";
import { applyMembershipActions } from "./membership.js";
import { applyOverlayActions } from "./overlay.js";
import { applyRoundActions } from "./round.js";
import { applyRuntimeActions } from "./runtime.js";
import { applyUiActions } from "./ui.js";

const reducers = [
    applyRuntimeActions,
    applyAuthActions,
    applyMembershipActions,
    applyChannelCreateActions,
    applyRoundActions,
    applyFeedActions,
    applyComposerActions,
    applyOverlayActions,
    applyUiActions
];

export const applyAction = (draft, action) => {
    for (const reducer of reducers) {
        if (reducer(draft, action)) {
            return;
        }
    }
};
