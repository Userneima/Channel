export const selectJoinRequestPanelVM = (state) => {
    const authStatus = state.authState.status;
    const membershipStatus = state.membershipState.status;
    const isUpgrade = authStatus === "upgrading_legacy_anonymous";
    const isApprovedMember = authStatus === "authenticated" && membershipStatus === "approved";
    const joinRequest = state.membershipState.joinRequest;
    const reviewNote = typeof joinRequest?.reviewNote === "string" ? joinRequest.reviewNote.trim() : "";

    if (isUpgrade) {
        return {
            visible: state.runtimeState.status !== "loading" && state.runtimeState.status !== "error",
            authStatus,
            membershipStatus,
            draftMessage: state.membershipState.draftMessage,
            submitStatus: state.membershipState.submitStatus,
            error: typeof state.membershipState.error === "string"
                ? state.membershipState.error
                : state.membershipState.error?.message || "",
            joinRequest,
            title: "继续升级账号",
            description: "完成正式账号升级后，你会直接回到当前频道。",
            primaryLabel: "继续升级",
            primaryAction: "upgrade",
            canSubmit: false
        };
    }

    if (isApprovedMember) {
        return {
            visible: false,
            authStatus,
            membershipStatus,
            draftMessage: state.membershipState.draftMessage,
            submitStatus: state.membershipState.submitStatus,
            error: "",
            joinRequest
        };
    }

    if (authStatus === "guest") {
        return {
            visible: state.runtimeState.status !== "loading" && state.runtimeState.status !== "error",
            authStatus,
            membershipStatus,
            draftMessage: state.membershipState.draftMessage,
            submitStatus: state.membershipState.submitStatus,
            error: typeof state.membershipState.error === "string"
                ? state.membershipState.error
                : state.membershipState.error?.message || "",
            joinRequest: null,
            title: "登录后即可参与",
            description: "注册或登录后会自动进入当前频道或进入申请流程。",
            primaryLabel: "邮箱登录",
            primaryAction: "login",
            canSubmit: false
        };
    }

    const pendingState = membershipStatus === "pending";
    const rejectedState = membershipStatus === "rejected";
    const cancelledState = membershipStatus === "cancelled";

    return {
        visible: state.runtimeState.status !== "loading" && state.runtimeState.status !== "error",
        authStatus,
        membershipStatus,
        draftMessage: state.membershipState.draftMessage,
        submitStatus: state.membershipState.submitStatus,
        error: typeof state.membershipState.error === "string"
            ? state.membershipState.error
            : state.membershipState.error?.message || "",
        joinRequest,
        title: pendingState
            ? "加入申请已提交"
            : rejectedState
                ? "加入申请未通过"
                : cancelledState
                    ? "你已不在当前频道"
                    : "申请加入当前频道",
        description: pendingState
            ? "管理员通过后，你就能发帖、评论和使用匿名马甲。"
            : rejectedState
                ? (reviewNote || "可以整理一下说明后重新申请加入。")
                : cancelledState
                    ? "如需继续参与当前频道，需要重新提交加入申请。"
                    : "通过后即可发帖、评论和使用匿名马甲。",
        primaryLabel: pendingState ? "等待审核" : (rejectedState || cancelledState ? "重新申请加入" : "申请加入"),
        primaryAction: pendingState ? "" : "submit",
        canSubmit: !pendingState
    };
};
