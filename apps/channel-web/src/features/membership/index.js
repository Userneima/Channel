import { getChannelActionErrorMessage } from "../../shared/lib/helpers.js";

export const createMembershipActions = ({ store, dataService, showToast, runtimeActions }) => ({
    setMembershipField(partial) {
        store.dispatch({
            type: "membership/set-field",
            payload: partial
        });
    },
    async submitJoinRequest(
        channelId = store.getState().runtimeState.channel?.id,
        message = store.getState().membershipState.draftMessage.trim()
    ) {
        const authState = store.getState().authState;
        if (!channelId) {
            return;
        }

        if (authState.status === "guest") {
            store.dispatch({
                type: "auth-gate/open",
                payload: { mode: "login" }
            });
            return;
        }

        if (authState.status === "upgrading_legacy_anonymous") {
            store.dispatch({
                type: "auth-gate/open",
                payload: { mode: "upgrade" }
            });
            return;
        }

        store.dispatch({
            type: "membership/set-submit-status",
            payload: { status: "submitting" }
        });
        store.dispatch({
            type: "membership/set-field",
            payload: { error: null }
        });

        try {
            const result = await dataService.submitJoinRequest(channelId, message);
            store.dispatch({
                type: "membership/set-field",
                payload: {
                    draftMessage: "",
                    error: null
                }
            });
            await runtimeActions.refreshChannelAccessState({
                reloadFeed: result?.status === "approved"
            });
            showToast({
                tone: "success",
                message: result?.status === "approved" ? "已进入频道。" : "加入申请已提交。"
            });
        } catch (error) {
            const message = getChannelActionErrorMessage("submit_join_request", error);
            store.dispatch({
                type: "membership/set-state",
                payload: {
                    submitStatus: "idle",
                    error: message
                }
            });
            showToast({
                tone: "error",
                message
            });
        }
    },
    async refreshMembershipReviews(channelId = store.getState().runtimeState.channel?.id) {
        if (!channelId) {
            return [];
        }

        store.dispatch({
            type: "membership/set-review-status",
            payload: { status: "loading" }
        });

        try {
            const reviewItems = await dataService.listPendingJoinRequests(channelId);
            store.dispatch({
                type: "membership/set-state",
                payload: {
                    reviewItems,
                    reviewStatus: "idle",
                    error: null
                }
            });
            return reviewItems;
        } catch (error) {
            const message = getChannelActionErrorMessage("load_membership_reviews", error);
            store.dispatch({
                type: "membership/set-state",
                payload: {
                    reviewStatus: "idle",
                    error: message
                }
            });
            showToast({
                tone: "error",
                message
            });
            return [];
        }
    },
    async approveJoinRequest(requestId) {
        store.dispatch({
            type: "membership/set-review-status",
            payload: { status: "submitting" }
        });

        try {
            await dataService.approveJoinRequest(requestId);
            await runtimeActions.loadMembershipState();
            await this.refreshMembershipReviews();
            showToast({
                tone: "success",
                message: "成员申请已通过。"
            });
        } catch (error) {
            const message = getChannelActionErrorMessage("approve_join_request", error);
            store.dispatch({
                type: "membership/set-review-status",
                payload: { status: "idle" }
            });
            showToast({
                tone: "error",
                message
            });
        }
    },
    async rejectJoinRequest(requestId, reason = "") {
        store.dispatch({
            type: "membership/set-review-status",
            payload: { status: "submitting" }
        });

        try {
            await dataService.rejectJoinRequest(requestId, reason);
            await runtimeActions.loadMembershipState();
            await this.refreshMembershipReviews();
            showToast({
                tone: "success",
                message: "成员申请已拒绝。"
            });
        } catch (error) {
            const message = getChannelActionErrorMessage("reject_join_request", error);
            store.dispatch({
                type: "membership/set-review-status",
                payload: { status: "idle" }
            });
            showToast({
                tone: "error",
                message
            });
        }
    },
    async loadMemberDirectory(channelId = store.getState().runtimeState.channel?.id) {
        if (!channelId) {
            return [];
        }

        store.dispatch({
            type: "membership/set-directory-status",
            payload: { status: "loading" }
        });
        store.dispatch({
            type: "membership/set-field",
            payload: {
                directoryError: null
            }
        });

        try {
            const directoryItems = await dataService.listChannelMembers(channelId);
            store.dispatch({
                type: "membership/set-state",
                payload: {
                    directoryItems,
                    directoryStatus: "idle",
                    directoryError: null
                }
            });
            return directoryItems;
        } catch (error) {
            const message = getChannelActionErrorMessage("load_channel_members", error);
            store.dispatch({
                type: "membership/set-state",
                payload: {
                    directoryStatus: "idle",
                    directoryError: message
                }
            });
            showToast({
                tone: "error",
                message
            });
            return [];
        }
    },
    async promoteMemberToAdmin(identityId) {
        store.dispatch({
            type: "membership/set-mutation-status",
            payload: {
                status: "submitting",
                identityId
            }
        });
        store.dispatch({
            type: "membership/set-field",
            payload: {
                directoryError: null
            }
        });

        try {
            await dataService.setChannelMemberRole(identityId, "admin");
            await this.loadMemberDirectory();
            await runtimeActions.loadMembershipState();
            showToast({
                tone: "success",
                message: "已设为管理员。"
            });
        } catch (error) {
            const message = getChannelActionErrorMessage("set_channel_member_role", error);
            store.dispatch({
                type: "membership/set-field",
                payload: {
                    directoryError: message
                }
            });
            showToast({
                tone: "error",
                message
            });
        } finally {
            store.dispatch({
                type: "membership/set-mutation-status",
                payload: {
                    status: "idle",
                    identityId: null
                }
            });
        }
    },
    async demoteAdminToMember(identityId) {
        store.dispatch({
            type: "membership/set-mutation-status",
            payload: {
                status: "submitting",
                identityId
            }
        });
        store.dispatch({
            type: "membership/set-field",
            payload: {
                directoryError: null
            }
        });

        try {
            await dataService.setChannelMemberRole(identityId, "member");
            await this.loadMemberDirectory();
            await runtimeActions.loadMembershipState();
            showToast({
                tone: "success",
                message: "管理员权限已移除。"
            });
        } catch (error) {
            const message = getChannelActionErrorMessage("set_channel_member_role", error);
            store.dispatch({
                type: "membership/set-field",
                payload: {
                    directoryError: message
                }
            });
            showToast({
                tone: "error",
                message
            });
        } finally {
            store.dispatch({
                type: "membership/set-mutation-status",
                payload: {
                    status: "idle",
                    identityId: null
                }
            });
        }
    },
    requestRemoveMember(identityId) {
        store.dispatch({
            type: "member-list/set-field",
            payload: {
                pendingRemoveIdentityId: identityId
            }
        });
    },
    cancelRemoveMember() {
        store.dispatch({
            type: "member-list/set-field",
            payload: {
                pendingRemoveIdentityId: null
            }
        });
    },
    async confirmRemoveMember(identityId) {
        store.dispatch({
            type: "membership/set-mutation-status",
            payload: {
                status: "submitting",
                identityId
            }
        });
        store.dispatch({
            type: "membership/set-field",
            payload: {
                directoryError: null
            }
        });

        try {
            await dataService.removeChannelMember(identityId);
            store.dispatch({
                type: "member-list/set-field",
                payload: {
                    pendingRemoveIdentityId: null
                }
            });
            await this.loadMemberDirectory();
            await runtimeActions.loadMembershipState();
            showToast({
                tone: "success",
                message: "成员已移出频道。"
            });
        } catch (error) {
            const message = getChannelActionErrorMessage("remove_channel_member", error);
            store.dispatch({
                type: "membership/set-field",
                payload: {
                    directoryError: message
                }
            });
            showToast({
                tone: "error",
                message
            });
        } finally {
            store.dispatch({
                type: "membership/set-mutation-status",
                payload: {
                    status: "idle",
                    identityId: null
                }
            });
        }
    }
});
