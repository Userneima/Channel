export const selectAuthGateVM = (state) => {
    const mode = state.overlayState.authGate.mode;
    const open = state.overlayState.authGate.open;
    const isRegister = mode === "register";
    const isUpgrade = mode === "upgrade";

    return {
        open,
        mode,
        displayName: state.authState.displayName,
        email: state.authState.email,
        password: state.authState.password,
        error: typeof state.authState.error === "string"
            ? state.authState.error
            : state.authState.error?.message || "",
        showDisplayName: isRegister,
        isVerifying: state.authState.status === "verifying",
        title: isRegister
            ? "注册后继续"
            : "登录后继续",
        description: isRegister
            ? "用昵称、邮箱和密码创建账号后，你就会自动加入当前频道。"
            : isUpgrade
                ? "先继续完成当前账号升级流程。"
                : "用邮箱和密码登录后，你就会自动加入当前频道。",
        submitLabel: state.authState.status === "verifying"
            ? (isRegister ? "注册中" : "登录中")
            : (isRegister ? "注册" : "登录"),
        canSubmit: (!isRegister || Boolean(state.authState.displayName.trim()))
            && Boolean(state.authState.email.trim())
            && Boolean(state.authState.password.trim())
            && state.authState.status !== "verifying",
        showModeSwitch: !isUpgrade,
        canClose: true
    };
};
