export const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const platformOperatorEmail = "wyc1186164839@gmail.com";

export const isPlatformOperatorEmail = (email) => String(email || "").trim().toLowerCase() === platformOperatorEmail;

const anonymousNamePrefixes = [
    "雾", "岚", "栖", "舟", "川", "汀", "野", "弦",
    "澄", "暮", "云", "白", "青", "鹿", "松", "迟"
];

const anonymousNameSuffixes = [
    "桥", "屿", "川", "汐", "禾", "野", "岚", "序",
    "音", "栈", "林", "澜", "舟", "雨", "歌", "隼"
];

const anonymousPalette = [
    ["#3b82f6", "#22c55e", "#0f172a"],
    ["#f97316", "#ef4444", "#1f2937"],
    ["#06b6d4", "#8b5cf6", "#111827"],
    ["#22c55e", "#eab308", "#17202a"],
    ["#ec4899", "#8b5cf6", "#1f1b2e"],
    ["#38bdf8", "#0ea5e9", "#0f172a"],
    ["#f59e0b", "#fb7185", "#241b15"],
    ["#a3e635", "#14b8a6", "#10231e"]
];

const toSeedNumber = (seed) => {
    const source = String(seed ?? `${Date.now()}-${Math.random()}`);
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
        hash = ((hash << 5) - hash) + source.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash);
};

const pickSeeded = (items, seedNumber, offset = 0) => items[(seedNumber + offset) % items.length];

const createAnonymousAvatar = (name, seed) => {
    const seedNumber = toSeedNumber(seed);
    const [primary, secondary, base] = pickSeeded(anonymousPalette, seedNumber);
    const accentX = 28 + (seedNumber % 28);
    const accentY = 24 + (seedNumber % 24);
    const orbitOffset = 8 + (seedNumber % 18);
    const monogram = Array.from(String(name || "匿名")).slice(-1)[0] || "匿";

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none">
            <defs>
                <linearGradient id="bg" x1="8" y1="8" x2="88" y2="88" gradientUnits="userSpaceOnUse">
                    <stop stop-color="${primary}" />
                    <stop offset="1" stop-color="${secondary}" />
                </linearGradient>
            </defs>
            <rect width="96" height="96" rx="48" fill="${base}" />
            <circle cx="48" cy="48" r="38" fill="url(#bg)" opacity="0.92" />
            <circle cx="${accentX}" cy="${accentY}" r="12" fill="rgba(255,255,255,0.2)" />
            <path d="M20 ${60 + orbitOffset}C31 ${46 + orbitOffset} 46 ${42 + orbitOffset} 68 ${26 + orbitOffset}" stroke="rgba(255,255,255,0.26)" stroke-width="5" stroke-linecap="round"/>
            <text x="48" y="56" text-anchor="middle" font-size="30" font-weight="700" fill="white" font-family="Arial, sans-serif">${monogram}</text>
        </svg>
    `.trim();

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const generateAnonymousPersona = (seed = `${Date.now()}-${Math.random()}`) => {
    const seedNumber = toSeedNumber(seed);
    const name = `${pickSeeded(anonymousNamePrefixes, seedNumber)}${pickSeeded(anonymousNameSuffixes, seedNumber, 7)}`;
    return {
        name,
        avatar: createAnonymousAvatar(name, seed)
    };
};

export const formatComposerTextForPost = (text) => escapeHtml(text)
    .replace(/(@[^\s@]+)/g, '<span class="text-accent">$1</span>')
    .replace(/\n/g, "<br/>");

export const getPostBodyText = (post) => post?.text ?? post?.fullText ?? "";

export const getPostPreviewText = (post, maxLength = 110) => {
    const fullText = getPostBodyText(post).trim();
    const normalizedText = fullText.replace(/\s+/g, " ");

    if (!normalizedText) {
        return {
            text: "",
            isTruncated: false
        };
    }

    if (normalizedText.length <= maxLength) {
        return {
            text: fullText,
            isTruncated: false
        };
    }

    const nextText = `${normalizedText.slice(0, maxLength).trimEnd()}...`;
    return {
        text: nextText,
        isTruncated: true
    };
};

export const readBlobAsDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

export const anonymizeComposerText = (rawText) => rawText
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[邮箱已隐藏]")
    .replace(/(?<!\d)1\d{10}(?!\d)/g, "[手机号已隐藏]")
    .replace(/(微信|vx|VX|vx号|微信号)[:：]?\s*[a-zA-Z0-9_-]{5,}/g, "$1[已隐藏]")
    .replace(/(QQ|qq|q号)[:：]?\s*\d{5,}/g, "$1[已隐藏]")
    .split("\n")
    .map((line) => line
        .replace(/我觉得/g, "换个角度看")
        .replace(/我认为/g, "更中性的看法是")
        .replace(/我想说/g, "想补充的是")
        .replace(/我想/g, "想")
        .replace(/我是/g, "这里是")
        .replace(/我的/g, "相关")
        .replace(/我们/g, "大家")
        .replace(/我/g, "这边")
        .replace(/哈哈+/g, "哈哈")
        .replace(/[!！]{2,}/g, "！")
        .replace(/[?？]{2,}/g, "？")
        .replace(/\s{2,}/g, " ")
    )
    .join("\n")
    .trim();

export const loadComposerImage = (url) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
});

export const cloneComposerImageForPost = async (image) => {
    const response = await fetch(image.url);
    const blob = await response.blob();
    return {
        id: image.id,
        name: image.name,
        url: await readBlobAsDataUrl(blob)
    };
};

export const processAnonymousImageForPost = async (image) => {
    const sourceImage = await loadComposerImage(image.url);
    const cropX = Math.round(sourceImage.naturalWidth * 0.04);
    const cropY = Math.round(sourceImage.naturalHeight * 0.04);
    const sourceWidth = Math.max(1, sourceImage.naturalWidth - cropX * 2);
    const sourceHeight = Math.max(1, sourceImage.naturalHeight - cropY * 2);
    const scale = Math.min(1, 1120 / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Canvas context is not available.");
    }

    const rotation = ((toSeedNumber(`${image.id}-${image.name}`) % 5) - 2) * 0.0045;
    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(rotation);
    context.filter = "blur(1.8px) saturate(0.84) contrast(0.94) brightness(1.04)";
    context.drawImage(
        sourceImage,
        cropX,
        cropY,
        sourceWidth,
        sourceHeight,
        -canvas.width / 2,
        -canvas.height / 2,
        canvas.width,
        canvas.height
    );
    context.restore();

    const vignette = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    vignette.addColorStop(0, "rgba(20, 20, 20, 0.12)");
    vignette.addColorStop(0.5, "rgba(255, 255, 255, 0.03)");
    vignette.addColorStop(1, "rgba(20, 20, 20, 0.14)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "rgba(16, 16, 16, 0.1)";
    context.fillRect(0, 0, canvas.width, 14);
    context.fillRect(0, canvas.height - 14, canvas.width, 14);
    context.fillRect(0, 0, 10, canvas.height);
    context.fillRect(canvas.width - 10, 0, 10, canvas.height);

    const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
    return {
        id: image.id,
        name: image.name,
        url: await readBlobAsDataUrl(blob)
    };
};

export const createImageDraftFromFile = (file, nextId) => ({
    id: nextId,
    kind: "image",
    name: file.name,
    url: URL.createObjectURL(file)
});

export const createAudioDraftFromBlob = (blob, nextId) => ({
    id: nextId,
    kind: "audio",
    name: `语音 ${nextId}`,
    url: URL.createObjectURL(blob),
    mimeType: blob.type || "audio/webm"
});

export const cloneComposerAudioForPost = async (audio) => {
    const response = await fetch(audio.url);
    const blob = await response.blob();
    return {
        id: audio.id,
        kind: "audio",
        name: audio.name,
        mimeType: audio.mimeType || blob.type || "audio/webm",
        url: await readBlobAsDataUrl(blob)
    };
};

export const revokeImageDrafts = (images) => {
    images.forEach((image) => {
        if (image?.url?.startsWith("blob:") && typeof URL.revokeObjectURL === "function") {
            URL.revokeObjectURL(image.url);
        }
    });
};

export const revokeComposerAudioDraft = (audio) => {
    if (audio?.url?.startsWith("blob:") && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(audio.url);
    }
};

export const copyText = async (text) => {
    if (!navigator.clipboard) {
        throw new Error("Clipboard is not available.");
    }
    await navigator.clipboard.writeText(text);
};

const channelRolePriority = {
    owner: 0,
    admin: 1,
    member: 2
};

export const getChannelRolePriority = (role) => channelRolePriority[String(role || "member").trim()] ?? 99;

export const resolveHighestChannelRole = ({
    members = [],
    currentUserId = "",
    currentIdentityId = "",
    fallbackRole = "member"
} = {}) => {
    const normalizedUserId = String(currentUserId || "").trim();
    const normalizedIdentityId = String(currentIdentityId || "").trim();
    let bestRole = String(fallbackRole || "member").trim() || "member";
    let bestPriority = getChannelRolePriority(bestRole);

    (members || []).forEach((member) => {
        const memberUserId = String(member?.userId || "").trim();
        const memberIdentityId = String(member?.identityId || "").trim();
        const matchesCurrent = (normalizedUserId && memberUserId === normalizedUserId)
            || (normalizedIdentityId && memberIdentityId === normalizedIdentityId);
        if (!matchesCurrent) {
            return;
        }

        const role = String(member?.role || "member").trim() || "member";
        const priority = getChannelRolePriority(role);
        if (priority < bestPriority) {
            bestRole = role;
            bestPriority = priority;
        }
    });

    return bestRole;
};

export const downloadJsonFile = (filename, value) => {
    const blob = new Blob(
        [JSON.stringify(value, null, 2)],
        { type: "application/json;charset=utf-8" }
    );
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
};

export const delay = (duration) => new Promise((resolve) => {
    window.setTimeout(resolve, duration);
});

export const getChannelActionErrorMessage = (action, error) => {
    const code = String(error?.code || "");
    const message = String(error?.message || "");
    const lowerMessage = message.toLowerCase();

    if (code === "anonymous_provider_disabled") {
        return "频道暂时无法进入，Supabase 还没有开启匿名登录。";
    }

    if (code === "42501") {
        if (action === "init_runtime") {
            return "频道权限初始化没有完成，请稍后重试。";
        }
        if (action === "remove_channel_member") {
            if (lowerMessage.includes("only channel admins can remove members")) {
                return "您为普通成员，暂无踢出成员的权限。";
            }
            if (lowerMessage.includes("you cannot remove the active identity")) {
                return "当前这条身份正在承载你的频道权限，不能直接移除。";
            }
            if (lowerMessage.includes("owner cannot be removed")) {
                return "创建者身份不能被移除。";
            }
            if (lowerMessage.includes("admins can only remove regular members")) {
                return "您当前是管理员，只能移除普通成员。";
            }
            if (lowerMessage.includes("owners can only remove their own duplicate lower-privilege identities")) {
                return "你只能清理自己名下重复的低权限身份，不能移除当前主身份。";
            }
            if (lowerMessage.includes("admins can only remove their own duplicate member identity")) {
                return "管理员只能清理自己名下重复的普通成员身份。";
            }
        }
        if (action === "set_channel_member_role") {
            if (lowerMessage.includes("only the channel owner can edit member roles")) {
                return "只有创建者可以调整成员角色。";
            }
            if (lowerMessage.includes("owner role cannot be changed")) {
                return "创建者身份不能降级。";
            }
            if (lowerMessage.includes("owner cannot remove their own management access")) {
                return "不能移除自己当前的管理权限。";
            }
        }
        if (action === "delete_round_archive") {
            if (lowerMessage.includes("only channel admins can delete archives")) {
                return "您为普通成员，暂无删除往期回合记录的权限。";
            }
        }
        if (action === "load_registered_users") {
            if (lowerMessage.includes("only the designated platform operator can view registered users")) {
                return "只有指定后台账号才能查看已注册用户。";
            }
        }
        return "当前操作被频道权限规则拦截，请刷新后重试。";
    }

    if (code === "PGRST116") {
        return "目标内容不存在，或者当前会话暂时无法读取它。";
    }

    if (code === "23505") {
        if (action === "submit_join_request") {
            return "你已经提交过待审核的申请了。";
        }
        return "数据已经存在，当前结果已保留。";
    }

    if (code === "42703" || code === "42P01" || code === "42883" || code === "PGRST202" || code === "PGRST204") {
        return "频道数据库还没完成升级，页面先按兼容模式打开。需要把最新 migration 应用到 Supabase。";
    }

    if (lowerMessage.includes("invalid login credentials")) {
        return action === "login_with_password"
            ? "账号或密码错误，请重试。"
            : "验证码无效或已过期，请重新获取。";
    }

    if (lowerMessage.includes("user already registered")) {
        return "这个邮箱已经注册过了，请直接登录。";
    }

    if (lowerMessage.includes("password should be at least")
        || lowerMessage.includes("weak password")
        || lowerMessage.includes("password is too weak")) {
        return "密码强度不够，请至少使用 6 位字符。";
    }

    if (lowerMessage.includes("invalid email")
        || lowerMessage.includes("unable to validate email address")
        || lowerMessage.includes("email address is invalid")) {
        return "邮箱格式不正确，请检查后重试。";
    }

    if (code === "auth_email_confirmation_required") {
        return "当前环境还没有关闭邮箱确认，注册后无法直接登录，请先调整 Supabase Auth 设置。";
    }

    if (lowerMessage.includes("token has expired")) {
        return "验证码无效或已过期，请重新获取。";
    }

    if (lowerMessage.includes("email rate limit exceeded")) {
        return "验证码发送过于频繁，请稍后再试。";
    }

    if (lowerMessage.includes("email not confirmed")) {
        return "邮箱验证还没有完成，请先完成收件箱里的确认步骤。";
    }

    if (lowerMessage.includes("failed to fetch") || lowerMessage.includes("network") || lowerMessage.includes("fetch")) {
        return "网络连接异常，请稍后再试。";
    }

    if (
        message.includes("请先应用最新 migration")
        || message.includes("还没同步到数据库")
        || message.includes("还没有初始化完成")
    ) {
        return message;
    }

    const fallbackMap = {
        init_runtime: "频道初始化失败，请重新尝试。",
        init_create_channel: "创建频道页初始化失败，请刷新后重试。",
        login_with_password: "登录失败，请检查账号和密码后重试。",
        register_with_password: "注册失败，请检查填写信息后重试。",
        logout: "退出登录失败，请稍后重试。",
        create_channel: "频道创建失败，请稍后重试。",
        send_login_otp: "验证码发送失败，请稍后重试。",
        verify_login_otp: "登录验证失败，请检查验证码后重试。",
        upgrade_legacy_account: "账号升级失败，请稍后重试。",
        publish_post: "帖子发送失败，草稿还保留着，可以直接重试。",
        publish_comment: "评论发送失败，请稍后重试。",
        like_comment: "评论点赞失败，请稍后重试。",
        delete_post: "帖子删除失败，请稍后重试。",
        delete_comment: "评论删除失败，请稍后重试。",
        update_identity: "昵称或头像保存失败，请稍后重试。",
        update_channel: "频道资料保存失败，请稍后重试。",
        update_round_state: "本周主题或上帝保存失败，请稍后重试。",
        archive_round: "回合归档失败，请稍后重试。",
        restore_round_archive: "恢复归档失败，请稍后重试。",
        rename_round_archive: "归档标题保存失败，请稍后重试。",
        export_round_archive: "归档导出失败，请稍后重试。",
        delete_round_archive: "归档记录删除失败，请稍后重试。",
        save_round_archive: "本轮已经结束，但归档保存失败，请稍后重试。",
        load_feed: "频道内容加载失败，请刷新或重试。",
        load_comments: "评论加载失败，请稍后重试。",
        submit_join_request: "进入频道失败，请稍后重试。",
        load_membership_reviews: "待审核列表加载失败，请稍后重试。",
        approve_join_request: "通过申请失败，请稍后重试。",
        reject_join_request: "拒绝申请失败，请稍后重试。",
        copy_post: "复制失败，请稍后重试。",
        read_avatar: "头像读取失败，请换一张图片再试。"
    };

    return fallbackMap[action] || "操作失败，请稍后重试。";
};
