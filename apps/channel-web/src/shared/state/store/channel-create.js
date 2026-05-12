export const applyChannelCreateActions = (draft, action) => {
    switch (action.type) {
    case "channel-create/set-field":
        Object.assign(draft.channelCreateState, action.payload);
        return true;
    case "channel-create/submit-start":
        draft.channelCreateState.status = "submitting";
        draft.channelCreateState.error = null;
        return true;
    case "channel-create/submit-error":
        draft.channelCreateState.status = "idle";
        draft.channelCreateState.error = action.payload.error;
        return true;
    case "channel-create/reset":
        draft.channelCreateState.name = "";
        draft.channelCreateState.description = "";
        draft.channelCreateState.status = "idle";
        draft.channelCreateState.error = null;
        return true;
    default:
        return false;
    }
};
