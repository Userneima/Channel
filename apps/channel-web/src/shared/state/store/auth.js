import { cloneSimple } from "./helpers.js";

export const applyAuthActions = (draft, action) => {
    switch (action.type) {
    case "auth/set-state":
        draft.authState = {
            ...draft.authState,
            ...action.payload,
            user: action.payload.user === undefined ? draft.authState.user : cloneSimple(action.payload.user)
        };
        return true;
    case "auth/set-field":
        Object.assign(draft.authState, action.payload);
        return true;
    case "auth/reset-flow":
        draft.authState.displayName = "";
        draft.authState.email = "";
        draft.authState.password = "";
        draft.authState.error = null;
        if (action.payload?.status) {
            draft.authState.status = action.payload.status;
        }
        return true;
    default:
        return false;
    }
};
