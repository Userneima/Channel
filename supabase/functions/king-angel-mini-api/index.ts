import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type ApiErrorCode = "unauthorized" | "forbidden" | "not_found" | "stage_locked" | "already_submitted" | "invalid_payload";
type Actor = { userId: string; openid: string };

const STAGE_ORDER = ["wish", "claim", "delivery", "guess", "reveal"];
const STAGE_LABELS: Record<string, string> = {
    wish: "许愿",
    claim: "认领",
    delivery: "交付",
    guess: "猜测",
    reveal: "揭晓"
};

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

class ApiError extends Error {
    code: ApiErrorCode;
    status: number;

    constructor(code: ApiErrorCode, message: string, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

const jsonResponse = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), {
    ...init,
    headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
        ...(init.headers || {})
    }
});

const ok = (data: unknown) => jsonResponse({ ok: true, data });
const fail = (error: ApiError | Error) => {
    const apiError = error instanceof ApiError
        ? error
        : new ApiError("invalid_payload", error.message || "请求失败。", 500);
    return jsonResponse({
        ok: false,
        error: {
            code: apiError.code,
            message: apiError.message
        }
    }, { status: apiError.status });
};

const getEnv = (name: string) => {
    const value = Deno.env.get(name);
    if (!value) {
        throw new ApiError("invalid_payload", `${name} is not configured.`, 503);
    }
    return value;
};

const createAdminClient = () => createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

const encodeBase64Url = (input: string | ArrayBuffer) => {
    const bytes = typeof input === "string"
        ? new TextEncoder().encode(input)
        : new Uint8Array(input);
    let binary = "";
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const decodeBase64Url = (input: string) => {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
    return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
};

const hmac = async (source: string) => {
    const secret = getEnv("MINI_SESSION_SECRET");
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    return encodeBase64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(source)));
};

const signSession = async (payload: Record<string, unknown>) => {
    const body = encodeBase64Url(JSON.stringify(payload));
    const signature = await hmac(body);
    return `${body}.${signature}`;
};

const verifySession = async (token: string) => {
    const [body, signature] = token.split(".");
    if (!body || !signature || await hmac(body) !== signature) {
        throw new ApiError("unauthorized", "登录态无效，请重新进入小程序。", 401);
    }
    const payload = JSON.parse(decodeBase64Url(body));
    if (!payload.exp || Number(payload.exp) < Date.now()) {
        throw new ApiError("unauthorized", "登录态已过期，请重新进入小程序。", 401);
    }
    return payload;
};

const authenticate = async (req: Request): Promise<Actor> => {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
        throw new ApiError("unauthorized", "请先登录。", 401);
    }

    const payload = await verifySession(token);
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("wechat_accounts")
        .select("user_id, openid, session_version")
        .eq("user_id", payload.userId)
        .eq("openid", payload.openid)
        .maybeSingle();

    if (error) {
        throw error;
    }
    if (!data || data.session_version !== payload.version) {
        throw new ApiError("unauthorized", "登录态已失效，请重新登录。", 401);
    }

    return {
        userId: data.user_id,
        openid: data.openid
    };
};

const trimText = (value: unknown, maxLength = 2000) => String(value || "").trim().slice(0, maxLength);

const requireText = (value: unknown, label: string, maxLength = 2000) => {
    const text = trimText(value, maxLength);
    if (!text) {
        throw new ApiError("invalid_payload", `${label}不能为空。`);
    }
    return text;
};

const assertStage = (stage: string, expected: string) => {
    if (stage !== expected) {
        throw new ApiError("stage_locked", `当前不是${STAGE_LABELS[expected]}阶段。`, 409);
    }
};

const assertManager = (identity: any) => {
    if (!["owner", "admin"].includes(identity?.role)) {
        throw new ApiError("forbidden", "只有创建者或管理员可以控场。", 403);
    }
};

const makeSlug = (name: string) => {
    const normalized = name
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `${normalized || "king-angel"}-${crypto.randomUUID().slice(0, 8)}`;
};

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const normalizeGame = (channel: any, round: any, memberCount = 0) => ({
    id: channel.id,
    slug: channel.slug,
    inviteCode: channel.slug,
    name: channel.name,
    description: channel.description || "",
    theme: round?.theme || channel.current_round_theme || "",
    currentStage: round?.current_stage || "wish",
    stageLabel: STAGE_LABELS[round?.current_stage || "wish"] || "许愿",
    memberCount
});

const getIdentity = async (supabase: any, channelId: string, userId: string) => {
    const { data, error } = await supabase
        .from("identities")
        .select("*")
        .eq("channel_id", channelId)
        .eq("user_id", userId)
        .maybeSingle();
    if (error) {
        throw error;
    }
    return data;
};

const getChannelByIdOrSlug = async (supabase: any, value: string) => {
    const query = supabase
        .from("channels")
        .select("*");
    const { data, error } = await (isUuid(value) ? query.eq("id", value) : query.eq("slug", value))
        .maybeSingle();
    if (error) {
        throw error;
    }
    if (!data) {
        throw new ApiError("not_found", "游戏不存在。", 404);
    }
    return data;
};

const syncRoundMembers = async (supabase: any, round: any) => {
    const { data: identities, error } = await supabase
        .from("identities")
        .select("*")
        .eq("channel_id", round.channel_id);
    if (error) {
        throw error;
    }

    for (const identity of identities || []) {
        const { error: upsertError } = await supabase
            .from("channel_round_members")
            .upsert({
                round_id: round.id,
                user_id: identity.user_id,
                identity_id: identity.id,
                display_name_snapshot: identity.display_name,
                avatar_snapshot: identity.avatar_url,
                role_snapshot: identity.role
            }, { onConflict: "round_id,user_id" });
        if (upsertError) {
            throw upsertError;
        }
    }
};

const ensureCurrentRound = async (supabase: any, channel: any) => {
    if (channel.current_round_id) {
        const { data, error } = await supabase
            .from("channel_rounds")
            .select("*")
            .eq("id", channel.current_round_id)
            .maybeSingle();
        if (error) {
            throw error;
        }
        if (data) {
            await syncRoundMembers(supabase, data);
            return data;
        }
    }

    const { data: round, error: roundError } = await supabase
        .from("channel_rounds")
        .insert({
            channel_id: channel.id,
            title: "第 1 轮",
            default_title: "第 1 轮",
            current_stage: "wish",
            started_at: new Date().toISOString()
        })
        .select("*")
        .single();
    if (roundError) {
        throw roundError;
    }

    const { error: channelError } = await supabase
        .from("channels")
        .update({ current_round_id: round.id, current_round_theme: round.theme || null })
        .eq("id", channel.id);
    if (channelError) {
        throw channelError;
    }

    await syncRoundMembers(supabase, round);
    return round;
};

const ensureAlias = async (supabase: any, identity: any, slotKey: string) => {
    const { data: existing, error: existingError } = await supabase
        .from("alias_sessions")
        .select("*")
        .eq("channel_id", identity.channel_id)
        .eq("identity_id", identity.id)
        .eq("slot_key", slotKey)
        .maybeSingle();
    if (existingError) {
        throw existingError;
    }
    if (existing) {
        return existing;
    }

    const seed = `${slotKey}-${identity.id}`.replace(/-/g, "").slice(0, 12);
    const { data, error } = await supabase
        .from("alias_sessions")
        .insert({
            channel_id: identity.channel_id,
            identity_id: identity.id,
            slot_key: slotKey,
            display_name: slotKey === "mini-wish" ? "匿名国王" : "匿名天使",
            avatar_url: `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}`
        })
        .select("*")
        .single();
    if (error) {
        throw error;
    }
    return data;
};

const getRoundMember = async (supabase: any, roundId: string, userId: string) => {
    const { data, error } = await supabase
        .from("channel_round_members")
        .select("*")
        .eq("round_id", roundId)
        .eq("user_id", userId)
        .maybeSingle();
    if (error) {
        throw error;
    }
    return data;
};

const getRealAuthor = (post: any) => post?.author_snapshot?.realIdentity || {};

const buildVisibleAuthor = (post: any, revealAllowed = false) => {
    const snapshot = post.author_snapshot || {};
    if (revealAllowed) {
        const real = snapshot.realIdentity || {};
        return {
            userId: real.userId || null,
            displayName: real.displayName || snapshot.displayName || "成员",
            avatarUrl: real.avatarUrl || snapshot.avatarUrl || "",
            role: real.role || "member"
        };
    }

    return {
        displayName: snapshot.kind === "alias" ? snapshot.displayName || "匿名" : "匿名",
        avatarUrl: snapshot.kind === "alias" ? snapshot.avatarUrl || "" : ""
    };
};

const buildPostPreview = (post: any, revealAllowed = false) => ({
    id: post.id,
    board: post.board_slug,
    preview: String(post.body || "").split(/\r?\n/).join(" ").slice(0, 80),
    body: post.body,
    createdAt: post.created_at,
    author: buildVisibleAuthor(post, revealAllowed)
});

const buildRevealPairs = (revealMap: Record<string, any>) => Object.values(revealMap || {})
    .filter((entry: any) => entry?.member?.name && entry?.angel?.name);

const handleMiniLogin = async (payload: any) => {
    const code = requireText(payload?.code, "登录 code", 128);
    const appid = getEnv("WECHAT_MINI_APP_ID");
    const secret = getEnv("WECHAT_MINI_APP_SECRET");
    const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
    url.searchParams.set("appid", appid);
    url.searchParams.set("secret", secret);
    url.searchParams.set("js_code", code);
    url.searchParams.set("grant_type", "authorization_code");

    const response = await fetch(url);
    const wxPayload = await response.json();
    if (!response.ok || !wxPayload.openid || wxPayload.errcode) {
        throw new ApiError("unauthorized", wxPayload.errmsg || "微信登录失败。", 401);
    }

    const supabase = createAdminClient();
    const openid = wxPayload.openid as string;
    const unionid = wxPayload.unionid || null;
    const { data: existingAccount, error: accountError } = await supabase
        .from("wechat_accounts")
        .select("*")
        .eq("openid", openid)
        .maybeSingle();
    if (accountError) {
        throw accountError;
    }

    let userId = existingAccount?.user_id;
    if (!userId) {
        const email = `wx_${openid}@mini.soulmap.local`;
        const { data: createdUser, error: userError } = await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: {
                display_name: "微信玩家"
            },
            app_metadata: {
                provider: "wechat-mini"
            }
        });
        if (userError) {
            throw userError;
        }
        userId = createdUser.user.id;

        const { error: profileError } = await supabase
            .from("profiles")
            .upsert({ id: userId, display_name: "微信玩家" }, { onConflict: "id" });
        if (profileError) {
            throw profileError;
        }

        const { error: insertError } = await supabase
            .from("wechat_accounts")
            .insert({ user_id: userId, openid, unionid });
        if (insertError) {
            throw insertError;
        }
    } else {
        const { error: updateError } = await supabase
            .from("wechat_accounts")
            .update({ unionid, last_login_at: new Date().toISOString() })
            .eq("openid", openid);
        if (updateError) {
            throw updateError;
        }
    }

    const { data: account, error: refreshedError } = await supabase
        .from("wechat_accounts")
        .select("*")
        .eq("openid", openid)
        .single();
    if (refreshedError) {
        throw refreshedError;
    }

    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;
    const token = await signSession({
        userId,
        openid,
        version: account.session_version,
        exp: expiresAt
    });

    return {
        token,
        expiresAt,
        user: {
            id: userId,
            displayName: "微信玩家"
        }
    };
};

const handleCreateGame = async (actor: Actor, payload: any) => {
    const name = requireText(payload?.name, "游戏名称", 32);
    const theme = trimText(payload?.theme, 80);
    const supabase = createAdminClient();
    const slug = makeSlug(name);

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", actor.userId)
        .maybeSingle();

    const { data: channel, error: channelError } = await supabase
        .from("channels")
        .insert({
            slug,
            name,
            description: "国王与天使游戏房间",
            visibility: "public",
            preview_visibility: "public",
            join_policy: "open",
            created_by: actor.userId,
            current_round_theme: theme || null
        })
        .select("*")
        .single();
    if (channelError) {
        throw channelError;
    }

    const { data: identity, error: identityError } = await supabase
        .from("identities")
        .insert({
            channel_id: channel.id,
            user_id: actor.userId,
            display_name: profile?.display_name || "创建者",
            avatar_url: profile?.avatar_url || null,
            role: "owner"
        })
        .select("*")
        .single();
    if (identityError) {
        throw identityError;
    }

    await ensureAlias(supabase, identity, "mini-wish");
    await ensureAlias(supabase, identity, "mini-delivery");
    const round = await ensureCurrentRound(supabase, channel);
    if (theme) {
        await supabase.from("channel_rounds").update({ theme }).eq("id", round.id);
    }

    return { game: normalizeGame(channel, { ...round, theme }, 1) };
};

const handleJoinGame = async (actor: Actor, payload: any) => {
    const inviteCode = requireText(payload?.inviteCode, "邀请口令", 128);
    const supabase = createAdminClient();
    const channel = await getChannelByIdOrSlug(supabase, inviteCode);
    let identity = await getIdentity(supabase, channel.id, actor.userId);

    if (!identity) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", actor.userId)
            .maybeSingle();
        const { data, error } = await supabase
            .from("identities")
            .insert({
                channel_id: channel.id,
                user_id: actor.userId,
                display_name: profile?.display_name || "微信玩家",
                avatar_url: profile?.avatar_url || null,
                role: "member"
            })
            .select("*")
            .single();
        if (error) {
            throw error;
        }
        identity = data;
    }

    await ensureAlias(supabase, identity, "mini-wish");
    await ensureAlias(supabase, identity, "mini-delivery");
    const round = await ensureCurrentRound(supabase, channel);
    return { game: normalizeGame(channel, round) };
};

const handleGetMyGames = async (actor: Actor) => {
    const supabase = createAdminClient();
    const { data: identities, error } = await supabase
        .from("identities")
        .select("channel_id, role")
        .eq("user_id", actor.userId);
    if (error) {
        throw error;
    }
    const channelIds = (identities || []).map((identity: any) => identity.channel_id);
    if (!channelIds.length) {
        return { games: [] };
    }

    const [
        { data: channels, error: channelsError },
        { data: rounds, error: roundsError },
        { data: allMembers, error: membersError }
    ] = await Promise.all([
        supabase.from("channels").select("*").in("id", channelIds),
        supabase.from("channel_rounds").select("*").in("channel_id", channelIds).eq("lifecycle_status", "active"),
        supabase.from("identities").select("channel_id").in("channel_id", channelIds)
    ]);
    if (channelsError) {
        throw channelsError;
    }
    if (roundsError) {
        throw roundsError;
    }
    if (membersError) {
        throw membersError;
    }

    const roundByChannel = new Map((rounds || []).map((round: any) => [round.channel_id, round]));
    const memberCountByChannel = new Map<string, number>();
    for (const member of allMembers || []) {
        memberCountByChannel.set(member.channel_id, (memberCountByChannel.get(member.channel_id) || 0) + 1);
    }
    return {
        games: (channels || []).map((channel: any) => normalizeGame(
            channel,
            roundByChannel.get(channel.id),
            memberCountByChannel.get(channel.id) || 0
        ))
    };
};

const handleGetGameState = async (actor: Actor, payload: any) => {
    const gameId = requireText(payload?.gameId, "游戏 ID", 128);
    const supabase = createAdminClient();
    const channel = await getChannelByIdOrSlug(supabase, gameId);
    const round = await ensureCurrentRound(supabase, channel);
    const identity = await getIdentity(supabase, channel.id, actor.userId);
    if (!identity) {
        throw new ApiError("forbidden", "你还没有加入这个游戏。", 403);
    }

    const [{ data: members }, { data: roundMembers }, { data: posts }] = await Promise.all([
        supabase.from("identities").select("*").eq("channel_id", channel.id).order("created_at", { ascending: true }),
        supabase.from("channel_round_members").select("*").eq("round_id", round.id),
        supabase.from("posts").select("*").eq("round_id", round.id).order("created_at", { ascending: true })
    ]);

    const currentRoundMember = (roundMembers || []).find((member: any) => member.user_id === actor.userId);
    const rawPosts = posts || [];
    const visiblePosts = rawPosts.map((post: any) => buildPostPreview(post, round.current_stage === "reveal"));
    const memberCount = members?.length || 0;

    return {
        game: normalizeGame(channel, round, memberCount),
        me: {
            identityId: identity.id,
            role: identity.role,
            canManage: ["owner", "admin"].includes(identity.role),
            roundStatus: {
                wishSubmitted: rawPosts.some((post: any) => post.board_slug === "wish" && getRealAuthor(post).userId === actor.userId),
                claimSelected: Boolean(currentRoundMember?.claim_post_id),
                deliverySubmitted: rawPosts.some((post: any) => post.board_slug === "delivery" && getRealAuthor(post).userId === actor.userId),
                guessSubmitted: Boolean(currentRoundMember?.guess_target_name_snapshot)
            }
        },
        members: (members || []).map((member: any) => ({
            identityId: member.id,
            userId: member.user_id,
            displayName: member.display_name,
            avatarUrl: member.avatar_url,
            role: member.role
        })),
        posts: visiblePosts,
        revealPairs: buildRevealPairs(round.reveal_map || {})
    };
};

const handleSubmitWish = async (actor: Actor, payload: any) => {
    const gameId = requireText(payload?.gameId, "游戏 ID", 128);
    const body = requireText(payload?.body, "愿望", 1200);
    const supabase = createAdminClient();
    const channel = await getChannelByIdOrSlug(supabase, gameId);
    const round = await ensureCurrentRound(supabase, channel);
    assertStage(round.current_stage, "wish");
    const identity = await getIdentity(supabase, channel.id, actor.userId);
    if (!identity) {
        throw new ApiError("forbidden", "你还没有加入这个游戏。", 403);
    }
    const alias = await ensureAlias(supabase, identity, "mini-wish");
    const { data: existing } = await supabase.from("posts").select("*").eq("round_id", round.id).eq("board_slug", "wish");
    if ((existing || []).some((post: any) => getRealAuthor(post).userId === actor.userId)) {
        throw new ApiError("already_submitted", "你已经提交过愿望。", 409);
    }
    const { data, error } = await supabase
        .from("posts")
        .insert({
            channel_id: channel.id,
            round_id: round.id,
            board_slug: "wish",
            alias_session_id: alias.id,
            body
        })
        .select("*")
        .single();
    if (error) {
        throw error;
    }
    return { post: buildPostPreview(data) };
};

const handleClaimWish = async (actor: Actor, payload: any) => {
    const gameId = requireText(payload?.gameId, "游戏 ID", 128);
    const wishPostId = requireText(payload?.targetId, "愿望", 128);
    const supabase = createAdminClient();
    const channel = await getChannelByIdOrSlug(supabase, gameId);
    const round = await ensureCurrentRound(supabase, channel);
    assertStage(round.current_stage, "claim");
    const identity = await getIdentity(supabase, channel.id, actor.userId);
    if (!identity) {
        throw new ApiError("forbidden", "你还没有加入这个游戏。", 403);
    }
    const roundMember = await getRoundMember(supabase, round.id, actor.userId);
    if (roundMember?.claim_post_id) {
        throw new ApiError("already_submitted", "你已经认领过愿望。", 409);
    }
    const { data: post, error: postError } = await supabase
        .from("posts")
        .select("*")
        .eq("id", wishPostId)
        .eq("round_id", round.id)
        .eq("board_slug", "wish")
        .maybeSingle();
    if (postError) {
        throw postError;
    }
    if (!post) {
        throw new ApiError("not_found", "愿望不存在。", 404);
    }
    if (getRealAuthor(post).userId === actor.userId) {
        throw new ApiError("forbidden", "不能认领自己的愿望。", 403);
    }
    const { error } = await supabase
        .from("channel_round_members")
        .update({ claim_post_id: post.id, claim_selected_at: new Date().toISOString() })
        .eq("round_id", round.id)
        .eq("user_id", actor.userId);
    if (error) {
        throw error;
    }
    await supabase.from("identities").update({
        current_claim_post_id: post.id,
        current_claim_selected_at: new Date().toISOString()
    }).eq("id", identity.id);
    return { claimedPostId: post.id };
};

const handleSubmitDelivery = async (actor: Actor, payload: any) => {
    const gameId = requireText(payload?.gameId, "游戏 ID", 128);
    const body = requireText(payload?.body, "交付内容", 2000);
    const supabase = createAdminClient();
    const channel = await getChannelByIdOrSlug(supabase, gameId);
    const round = await ensureCurrentRound(supabase, channel);
    assertStage(round.current_stage, "delivery");
    const identity = await getIdentity(supabase, channel.id, actor.userId);
    if (!identity) {
        throw new ApiError("forbidden", "你还没有加入这个游戏。", 403);
    }
    const roundMember = await getRoundMember(supabase, round.id, actor.userId);
    if (!roundMember?.claim_post_id) {
        throw new ApiError("forbidden", "需要先认领愿望。", 403);
    }
    const { data: existingDelivery } = await supabase
        .from("posts")
        .select("*")
        .eq("round_id", round.id)
        .eq("board_slug", "delivery");
    if ((existingDelivery || []).some((post: any) => getRealAuthor(post).userId === actor.userId)) {
        throw new ApiError("already_submitted", "你已经提交过交付。", 409);
    }
    const { data: claimedPost } = await supabase.from("posts").select("*").eq("id", roundMember.claim_post_id).maybeSingle();
    const targetName = getRealAuthor(claimedPost).displayName || "国王";
    const alias = await ensureAlias(supabase, identity, "mini-delivery");
    const { data, error } = await supabase
        .from("posts")
        .insert({
            channel_id: channel.id,
            round_id: round.id,
            board_slug: "delivery",
            alias_session_id: alias.id,
            body: `@${targetName}\n${body}`
        })
        .select("*")
        .single();
    if (error) {
        throw error;
    }
    return { post: buildPostPreview(data) };
};

const handleSubmitGuess = async (actor: Actor, payload: any) => {
    const gameId = requireText(payload?.gameId, "游戏 ID", 128);
    const targetIndex = Number(payload?.targetId);
    const supabase = createAdminClient();
    const channel = await getChannelByIdOrSlug(supabase, gameId);
    const round = await ensureCurrentRound(supabase, channel);
    assertStage(round.current_stage, "guess");
    const identity = await getIdentity(supabase, channel.id, actor.userId);
    if (!identity) {
        throw new ApiError("forbidden", "你还没有加入这个游戏。", 403);
    }
    const roundMember = await getRoundMember(supabase, round.id, actor.userId);
    if (roundMember?.guess_target_name_snapshot) {
        throw new ApiError("already_submitted", "你已经提交过猜测。", 409);
    }
    const { data: members } = await supabase.from("identities").select("*").eq("channel_id", channel.id).order("created_at", { ascending: true });
    const target = members?.[targetIndex];
    if (!target) {
        throw new ApiError("invalid_payload", "请选择你猜测的天使。");
    }
    const { error } = await supabase
        .from("channel_round_members")
        .update({
            guess_target_user_id: target.user_id,
            guess_target_name_snapshot: target.display_name,
            guess_target_avatar_snapshot: target.avatar_url,
            guess_selected_at: new Date().toISOString()
        })
        .eq("round_id", round.id)
        .eq("user_id", actor.userId);
    if (error) {
        throw error;
    }
    await supabase.from("identities").update({
        current_guess_name: target.display_name,
        current_guess_avatar: target.avatar_url,
        current_guess_selected_at: new Date().toISOString()
    }).eq("id", identity.id);
    return { guessedUserId: target.user_id };
};

const generateRevealMap = async (supabase: any, round: any) => {
    const [{ data: roundMembers }, { data: posts }] = await Promise.all([
        supabase.from("channel_round_members").select("*").eq("round_id", round.id),
        supabase.from("posts").select("*").eq("round_id", round.id)
    ]);
    const wishById = new Map((posts || []).filter((post: any) => post.board_slug === "wish").map((post: any) => [post.id, post]));
    const revealMap: Record<string, any> = {};

    for (const angel of roundMembers || []) {
        const wish = wishById.get(angel.claim_post_id);
        const king = getRealAuthor(wish);
        if (!king?.displayName || !angel.display_name_snapshot || king.userId === angel.user_id) {
            continue;
        }
        revealMap[king.displayName] = {
            member: {
                name: king.displayName,
                avatar: king.avatarUrl || ""
            },
            angel: {
                name: angel.display_name_snapshot,
                avatar: angel.avatar_snapshot || ""
            },
            wishPostId: wish.id,
            wishPreview: String(wish.body || "").slice(0, 80),
            guessedAngelName: angel.guess_target_name_snapshot || "",
            guessedAngelAvatar: angel.guess_target_avatar_snapshot || "",
            updatedAt: new Date().toISOString()
        };
    }

    return revealMap;
};

const handleAdvanceStage = async (actor: Actor, payload: any) => {
    const gameId = requireText(payload?.gameId, "游戏 ID", 128);
    const nextStage = requireText(payload?.nextStage, "下一阶段", 32);
    if (!STAGE_ORDER.includes(nextStage)) {
        throw new ApiError("invalid_payload", "阶段不存在。");
    }
    const supabase = createAdminClient();
    const channel = await getChannelByIdOrSlug(supabase, gameId);
    const identity = await getIdentity(supabase, channel.id, actor.userId);
    assertManager(identity);
    const round = await ensureCurrentRound(supabase, channel);
    const currentIndex = STAGE_ORDER.indexOf(round.current_stage);
    const nextIndex = STAGE_ORDER.indexOf(nextStage);
    if (nextIndex <= currentIndex) {
        throw new ApiError("invalid_payload", "只能推进到后续阶段。");
    }
    const theme = trimText(payload?.theme, 80) || round.theme || null;
    const { data, error } = await supabase
        .from("channel_rounds")
        .update({ current_stage: nextStage, theme, updated_at: new Date().toISOString() })
        .eq("id", round.id)
        .select("*")
        .single();
    if (error) {
        throw error;
    }
    await supabase.from("channels").update({ current_round_theme: theme }).eq("id", channel.id);
    return { game: normalizeGame(channel, data) };
};

const handleGenerateReveal = async (actor: Actor, payload: any, confirm = false) => {
    const gameId = requireText(payload?.gameId, "游戏 ID", 128);
    const supabase = createAdminClient();
    const channel = await getChannelByIdOrSlug(supabase, gameId);
    const identity = await getIdentity(supabase, channel.id, actor.userId);
    assertManager(identity);
    const round = await ensureCurrentRound(supabase, channel);
    const revealMap = await generateRevealMap(supabase, round);
    const { data, error } = await supabase
        .from("channel_rounds")
        .update({
            reveal_map: revealMap,
            current_stage: confirm ? "reveal" : round.current_stage,
            updated_at: new Date().toISOString()
        })
        .eq("id", round.id)
        .select("*")
        .single();
    if (error) {
        throw error;
    }
    return {
        revealPairs: buildRevealPairs(data.reveal_map || {})
    };
};

const handlers: Record<string, (actor: Actor | null, payload: any) => Promise<unknown>> = {
    mini_login: (_actor, payload) => handleMiniLogin(payload),
    create_game: (actor, payload) => handleCreateGame(actor!, payload),
    join_game: (actor, payload) => handleJoinGame(actor!, payload),
    get_my_games: (actor) => handleGetMyGames(actor!),
    get_game_state: (actor, payload) => handleGetGameState(actor!, payload),
    submit_wish: (actor, payload) => handleSubmitWish(actor!, payload),
    claim_wish: (actor, payload) => handleClaimWish(actor!, payload),
    submit_delivery: (actor, payload) => handleSubmitDelivery(actor!, payload),
    submit_guess: (actor, payload) => handleSubmitGuess(actor!, payload),
    advance_stage: (actor, payload) => handleAdvanceStage(actor!, payload),
    generate_reveal: (actor, payload) => handleGenerateReveal(actor!, payload),
    confirm_reveal: (actor, payload) => handleGenerateReveal(actor!, payload, true)
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
        return fail(new ApiError("invalid_payload", "Method not allowed.", 405));
    }

    try {
        const body = await req.json().catch(() => ({}));
        const action = String(body?.action || "").trim();
        const handler = handlers[action];
        if (!handler) {
            throw new ApiError("invalid_payload", "未知的小程序 API。");
        }
        const actor = action === "mini_login" ? null : await authenticate(req);
        return ok(await handler(actor, body?.payload || {}));
    } catch (error) {
        return fail(error as Error);
    }
});
