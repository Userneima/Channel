import { buildChannelMemberOptions } from "../../features/round/model.js";
import { getChannelRolePriority, resolveHighestChannelRole } from "../../shared/lib/helpers.js";

const roleLabelByValue = {
    owner: "创建者",
    admin: "管理员",
    member: "成员"
};

const getRoleLabel = (role) => roleLabelByValue[String(role || "member").trim()] || "成员";

const dedupeDirectoryMembers = (members = []) => {
    const memberByKey = new Map();

    members.forEach((member, index) => {
        const userId = String(member?.userId || "").trim();
        const identityId = String(member?.identityId || "").trim();
        const key = userId || identityId || `member-${index}`;
        const current = memberByKey.get(key);

        if (!current) {
            memberByKey.set(key, member);
            return;
        }

        const nextPriority = getChannelRolePriority(member?.role);
        const currentPriority = getChannelRolePriority(current?.role);
        if (nextPriority < currentPriority) {
            memberByKey.set(key, member);
            return;
        }

        if (nextPriority === currentPriority) {
            const nextCreatedAt = Date.parse(member?.createdAt || 0);
            const currentCreatedAt = Date.parse(current?.createdAt || 0);
            if (nextCreatedAt > currentCreatedAt) {
                memberByKey.set(key, member);
            }
        }
    });

    return [...memberByKey.values()];
};

const buildReadonlyMembers = (state) => {
    const currentIdentityId = state.runtimeState.realIdentity.id;
    const currentName = String(state.runtimeState.realIdentity.name || "").trim();
    const currentRole = state.runtimeState.realIdentity.role || "member";

    return buildChannelMemberOptions(state).map((member) => {
        const isCurrent = (member.identityId && member.identityId === currentIdentityId)
            || (currentName && String(member.name || "").trim() === currentName);

        return {
            identityId: member.identityId || null,
            name: member.name,
            avatar: member.avatar,
            role: isCurrent ? currentRole : "member",
            roleLabel: isCurrent ? getRoleLabel(currentRole) : "成员",
            canPromote: false,
            canDemote: false,
            canRemove: false,
            confirmRemove: false,
            isBusy: false
        };
    });
};

const buildManageMembers = (state) => {
    const currentRole = resolveHighestChannelRole({
        members: state.membershipState.directoryItems || [],
        currentUserId: state.authState.user?.id || "",
        currentIdentityId: state.runtimeState.realIdentity.id,
        fallbackRole: state.runtimeState.realIdentity.role
    });
    const currentIdentityId = state.runtimeState.realIdentity.id;
    const pendingRemoveIdentityId = state.overlayState.memberList.pendingRemoveIdentityId;
    const activeMemberId = state.membershipState.activeMemberId;
    const actionsLocked = state.membershipState.mutationStatus === "submitting";

    return dedupeDirectoryMembers(state.membershipState.directoryItems || []).map((member) => {
        const role = String(member.role || "member").trim() || "member";
        const isCurrent = Boolean(member.identityId) && member.identityId === currentIdentityId;
        const canPromote = currentRole === "owner" && role === "member" && !isCurrent;
        const canDemote = currentRole === "owner" && role === "admin" && !isCurrent;
        const canRemove = role === "member" && !isCurrent && ["owner", "admin"].includes(currentRole);

        return {
            identityId: member.identityId || null,
            name: member.name,
            avatar: member.avatar,
            role,
            roleLabel: getRoleLabel(role),
            canPromote,
            canDemote,
            canRemove,
            confirmRemove: pendingRemoveIdentityId === member.identityId,
            isBusy: activeMemberId === member.identityId,
            actionsLocked
        };
    });
};

export const selectMemberListDialogVM = (state) => {
    const effectiveCurrentRole = resolveHighestChannelRole({
        members: state.membershipState.directoryItems || [],
        currentUserId: state.authState.user?.id || "",
        currentIdentityId: state.runtimeState.realIdentity.id,
        fallbackRole: state.runtimeState.realIdentity.role
    });
    const canManageMembers = state.overlayState.memberList.mode === "manage"
        && state.membershipState.status === "approved"
        && ["owner", "admin"].includes(effectiveCurrentRole);
    const members = canManageMembers ? buildManageMembers(state) : buildReadonlyMembers(state);

    return {
        open: state.overlayState.memberList.open,
        mode: canManageMembers ? "manage" : "view",
        subtitle: `${members.length} 位当前社区成员`,
        loading: canManageMembers && state.membershipState.directoryStatus === "loading",
        error: canManageMembers ? (state.membershipState.directoryError || "") : "",
        members,
        actionsLocked: state.membershipState.mutationStatus === "submitting"
    };
};
