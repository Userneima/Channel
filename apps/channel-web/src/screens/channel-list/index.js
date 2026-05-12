import "./styles.css";
import { escapeHtml } from "../../shared/lib/helpers.js";
import { runtimeConfig } from "../../shared/config/runtime-config.js";

const buildStatLabel = (count) => `${count} 条讨论`;

const getFallbackChannels = () => {
    if (!runtimeConfig.channelSlug) {
        return [];
    }

    return [{
        slug: runtimeConfig.channelSlug,
        name: runtimeConfig.channelName || runtimeConfig.channelSlug,
        description: "进入频道后即可查看讨论流、身份切换和最小互动闭环。",
        discussionCount: 0,
        badge: (runtimeConfig.channelName || runtimeConfig.channelSlug || "频").slice(0, 1)
    }];
};

const buildChannelCard = (channel) => `
    <a class="channel-directory__card" href="?channel=${encodeURIComponent(channel.slug)}">
        <div class="channel-directory__card-top">
            <div class="channel-directory__badge">${escapeHtml(channel.badge)}</div>
            <div class="channel-directory__meta">
                <h2>${escapeHtml(channel.name)}</h2>
                <p>${escapeHtml(channel.description || "进入频道后即可查看讨论流、身份切换和最小互动闭环。")}</p>
            </div>
        </div>
        <div class="channel-directory__footer">
            <span class="channel-directory__stat">${escapeHtml(buildStatLabel(channel.discussionCount || 0))}</span>
            <span class="channel-directory__enter">进入频道</span>
        </div>
    </a>
`;

const buildDirectoryHero = ({ realChannelHref = "", realChannelLabel = "进入真实频道" }) => `
    <header class="channel-directory__hero">
        <div>
            <div class="channel-directory__brand">Soulmap</div>
            <h1>先试玩，再进入真实频道</h1>
            <p>第一次打开链接，先完整体验一轮许愿、选愿望、交付、猜测和揭晓。真正参与本周回合，再进入真实频道登录和加入。</p>
            <div class="channel-directory__hero-actions">
                <a class="channel-directory__hero-action channel-directory__hero-action--primary" href="?view=demo">先试玩完整流程</a>
                <a class="channel-directory__hero-action" href="${escapeHtml(realChannelHref || "#real-channels")}">${escapeHtml(realChannelLabel)}</a>
            </div>
            <div class="channel-directory__hero-note">试玩不会写入真实频道，也不要求先登录。</div>
        </div>
    </header>
`;

const renderState = (root, title, description, realChannelHref = "") => {
    root.innerHTML = `
        <div class="channel-directory">
            ${buildDirectoryHero({
        realChannelHref,
        realChannelLabel: realChannelHref ? "进入真实频道" : "查看公开频道"
    })}
            <section class="channel-directory__section">
                <div class="channel-directory__section-head">
                    <h2>${escapeHtml(title)}</h2>
                    <p>${escapeHtml(description)}</p>
                </div>
            </section>
        </div>
    `;
};

const renderDirectory = (root, channels) => {
    const realChannelHref = channels[0]?.slug
        ? `?channel=${encodeURIComponent(channels[0].slug)}`
        : runtimeConfig.channelSlug
            ? `?channel=${encodeURIComponent(runtimeConfig.channelSlug)}`
            : "";
    root.innerHTML = `
        <div class="channel-directory">
            ${buildDirectoryHero({
        realChannelHref,
        realChannelLabel: realChannelHref ? "进入真实频道" : "查看公开频道"
    })}
            <section class="channel-directory__section">
                <div class="channel-directory__section-head" id="real-channels">
                    <h2>真实频道</h2>
                    <p>这里连接真实数据。先试玩，再决定是否进入正式回合。</p>
                </div>
                <div class="channel-directory__grid">
                ${channels.length
        ? channels.map((channel) => buildChannelCard(channel)).join("")
        : `
                    <div class="channel-directory__empty">
                        <h2>还没有可浏览的频道</h2>
                        <p>试玩模式已经可以完整体验流程；真实频道准备好后，会在这里出现。</p>
                    </div>
                `}
                </div>
            </section>
        </div>
    `;
};

export const mountChannelListPage = async ({ root, dataService }) => {
    const fallbackChannels = getFallbackChannels();
    if (fallbackChannels.length) {
        renderDirectory(root, fallbackChannels);
    } else {
        renderState(
            root,
            "真实频道暂未就绪",
            "你仍然可以先通过试玩模式完整走一轮 Soulmap 的五阶段流程。",
            runtimeConfig.channelSlug ? `?channel=${encodeURIComponent(runtimeConfig.channelSlug)}` : ""
        );
    }

    try {
        const channels = await dataService.listPublicChannels();
        renderDirectory(root, channels);
    } catch (error) {
        if (!fallbackChannels.length) {
            renderState(
                root,
                "频道列表暂时不可用",
                error?.message || "公开频道读取失败，请稍后刷新。",
                runtimeConfig.channelSlug ? `?channel=${encodeURIComponent(runtimeConfig.channelSlug)}` : ""
            );
        }
    }
};
