const formatDateTimeLabel = (value) => {
    const timestamp = Date.parse(value || "");
    if (!Number.isFinite(timestamp)) {
        return "暂时没有记录";
    }

    return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    }).format(timestamp).replace(/\//g, ".");
};

export const selectRegisteredUsersDialogVM = (state) => {
    const overlay = state.overlayState.registeredUsers;
    const items = (overlay.items || []).map((item) => ({
        ...item,
        createdAtLabel: formatDateTimeLabel(item.createdAt),
        lastSignInAtLabel: formatDateTimeLabel(item.lastSignInAt),
        hasSignedIn: Boolean(item.lastSignInAt)
    }));

    return {
        open: overlay.open,
        loading: overlay.status === "loading",
        error: overlay.error || "",
        subtitle: `${items.length} 个已注册账号`,
        items
    };
};
