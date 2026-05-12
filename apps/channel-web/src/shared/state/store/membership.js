import { cloneSimple } from "./helpers.js";

export const applyMembershipActions = (draft, action) => {
    switch (action.type) {
    case "membership/set-state":
        draft.membershipState = {
            ...draft.membershipState,
            ...action.payload,
            joinRequest: action.payload.joinRequest === undefined
                ? draft.membershipState.joinRequest
                : cloneSimple(action.payload.joinRequest),
            reviewItems: action.payload.reviewItems === undefined
                ? draft.membershipState.reviewItems.map((item) => ({ ...item }))
                : action.payload.reviewItems.map((item) => ({ ...item })),
            directoryItems: action.payload.directoryItems === undefined
                ? (draft.membershipState.directoryItems || []).map((item) => ({ ...item }))
                : action.payload.directoryItems.map((item) => ({ ...item }))
        };
        return true;
    case "membership/set-field":
        Object.assign(draft.membershipState, action.payload);
        return true;
    case "membership/set-submit-status":
        draft.membershipState.submitStatus = action.payload.status;
        return true;
    case "membership/set-review-status":
        draft.membershipState.reviewStatus = action.payload.status;
        return true;
    case "membership/set-directory-status":
        draft.membershipState.directoryStatus = action.payload.status;
        return true;
    case "membership/set-mutation-status":
        draft.membershipState.mutationStatus = action.payload.status;
        draft.membershipState.activeMemberId = action.payload.identityId ?? null;
        return true;
    default:
        return false;
    }
};
