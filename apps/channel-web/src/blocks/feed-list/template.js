import { escapeHtml, formatComposerTextForPost } from "../../shared/lib/helpers.js";

const buildGuessPicker = (vm) => `
    <section class="guess-picker">
        <div class="guess-picker__grid">
            ${vm.candidates.map((candidate) => `
                <article class="guess-picker__card ${candidate.isSelected ? "is-selected" : ""} ${candidate.isExcluded ? "is-excluded" : ""}">
                    <img alt="${escapeHtml(candidate.name)}" class="guess-picker__avatar" src="${candidate.avatar}" />
                    <span class="guess-picker__name">${escapeHtml(candidate.name)}</span>
                    <span class="guess-picker__meta">${candidate.isSelected ? "已锁定" : candidate.isExcluded ? "已排除" : "待判断"}</span>
                    <div class="guess-picker__actions">
                        <button class="guess-picker__action ${candidate.isSelected ? "is-active" : ""}" data-feed-action="select-guess-target" data-guess-name="${encodeURIComponent(candidate.name)}" data-guess-avatar="${encodeURIComponent(candidate.avatar || "")}" ${candidate.isExcluded || candidate.isDisabled ? "disabled" : ""} type="button">
                            ${candidate.isSelected ? "已选" : "选他"}
                        </button>
                        <button class="guess-picker__action guess-picker__action--secondary ${candidate.isExcluded ? "is-active" : ""}" data-feed-action="toggle-guess-exclusion" data-guess-name="${encodeURIComponent(candidate.name)}" ${candidate.isDisabled ? "disabled" : ""} type="button">
                            ${candidate.isExcluded ? "取消排除" : "排除"}
                        </button>
                    </div>
                </article>
            `).join("")}
        </div>
        <div class="guess-picker__composer">
            <div class="guess-picker__composer-head">
                <div class="guess-picker__selection">
                    <span class="guess-picker__selection-label">当前锁定</span>
                    ${vm.selectedCandidate ? `
                        <span class="guess-picker__selection-chip">
                            <img alt="${escapeHtml(vm.selectedCandidate.name)}" class="guess-picker__selection-avatar" src="${vm.selectedCandidate.avatar || ""}" />
                            <span>${escapeHtml(vm.selectedCandidate.name)}</span>
                        </span>
                    ` : `<span class="guess-picker__selection-empty">还没选人</span>`}
                </div>
                ${vm.excludedNames.length ? `
                    <div class="guess-picker__excluded-summary">已排除 ${vm.excludedNames.length} 人</div>
                ` : ""}
            </div>
            <label class="guess-picker__field">
                <span class="guess-picker__field-label">推理依据</span>
                <textarea class="guess-picker__textarea" data-feed-input="guess-reason" ${vm.canEditGuessSelection ? "" : "disabled"} placeholder="可以在这里输入你已经收集到的信息进行推理">${escapeHtml(vm.guessDraftText || "")}</textarea>
            </label>
            <div class="guess-picker__footer">
                <button class="guess-picker__submit" data-feed-action="submit-guess" ${vm.canSubmitGuess && vm.submitStatus !== "submitting" ? "" : "disabled"} type="button">
                    ${vm.submitStatus === "submitting" ? "提交中" : "提交猜测"}
                </button>
            </div>
        </div>
    </section>
`;

const buildArchivedClaimSummary = (vm) => `
    <section class="reveal-results">
        ${vm.items.length ? `
            <div class="reveal-results__list">
                ${vm.items.map((item) => `
                    <article class="reveal-results__card">
                        <div class="reveal-results__head">
                            <div class="reveal-results__person-block">
                                <span class="reveal-results__label">谁在选愿望</span>
                                <div class="reveal-results__person">
                                    ${item.memberAvatar ? `<img alt="${escapeHtml(item.memberName)}" class="reveal-results__avatar" src="${item.memberAvatar}" />` : ""}
                                    <span>${escapeHtml(item.memberName)}</span>
                                </div>
                            </div>
                            <div class="reveal-results__person-block">
                                <span class="reveal-results__label">锁定对象</span>
                                ${item.claimTargetName ? `
                                    <div class="reveal-results__person">
                                        ${item.claimTargetAvatar ? `<img alt="${escapeHtml(item.claimTargetName)}" class="reveal-results__avatar" src="${item.claimTargetAvatar}" />` : ""}
                                        <span>${escapeHtml(item.claimTargetName)}</span>
                                    </div>
                                ` : `
                                    <div class="reveal-results__copy">这位成员当时还没锁定愿望。</div>
                                `}
                            </div>
                        </div>
                        <div class="reveal-results__meta-block">
                            <span class="reveal-results__label">愿望摘要</span>
                            <div class="reveal-results__copy">${escapeHtml(item.wishPreview || "这条愿望的摘要没有保存在归档里。")}</div>
                        </div>
                    </article>
                `).join("")}
            </div>
        ` : `
            <div class="feed-list__state">
                <div class="feed-list__state-icon"><span class="material-icons-outlined">assignment_turned_in</span></div>
                <h3>这份归档里还没有选愿望记录</h3>
                <p>当前选愿望阶段的快照暂时为空。</p>
            </div>
        `}
    </section>
`;

const buildArchivedGuessSummary = (vm) => `
    <section class="reveal-results">
        ${vm.items.length ? `
            <div class="reveal-results__list">
                ${vm.items.map((item) => `
                    <article class="reveal-results__card">
                        <div class="reveal-results__head">
                            <div class="reveal-results__person-block">
                                <span class="reveal-results__label">谁在猜</span>
                                <div class="reveal-results__person">
                                    ${item.memberAvatar ? `<img alt="${escapeHtml(item.memberName)}" class="reveal-results__avatar" src="${item.memberAvatar}" />` : ""}
                                    <span>${escapeHtml(item.memberName)}</span>
                                </div>
                            </div>
                            <div class="reveal-results__person-block">
                                <span class="reveal-results__label">猜的是谁</span>
                                ${item.guessTargetName ? `
                                    <div class="reveal-results__person">
                                        ${item.guessTargetAvatar ? `<img alt="${escapeHtml(item.guessTargetName)}" class="reveal-results__avatar" src="${item.guessTargetAvatar}" />` : ""}
                                        <span>${escapeHtml(item.guessTargetName)}</span>
                                    </div>
                                ` : `
                                    <div class="reveal-results__copy">这位成员当时还没提交猜测。</div>
                                `}
                            </div>
                        </div>
                    </article>
                `).join("")}
            </div>
        ` : `
            <div class="feed-list__state">
                <div class="feed-list__state-icon"><span class="material-icons-outlined">psychology</span></div>
                <h3>这份归档里还没有猜测记录</h3>
                <p>当前猜测阶段的快照暂时为空。</p>
            </div>
        `}
    </section>
`;

const buildRevealResults = (vm) => `
    <section class="reveal-results">
        ${vm.revealPairs.length ? `
            <div class="reveal-results__list">
                ${vm.revealPairs.map((pair) => `
                    <article class="reveal-results__card">
                        <div class="reveal-results__head">
                            <div class="reveal-results__person-block">
                                <span class="reveal-results__label">国王</span>
                                <div class="reveal-results__person">
                                    ${pair.member.avatar ? `<img alt="${escapeHtml(pair.member.name)}" class="reveal-results__avatar" src="${pair.member.avatar}" />` : ""}
                                    <span>${escapeHtml(pair.member.name)}</span>
                                </div>
                            </div>
                            <div class="reveal-results__person-block">
                                <span class="reveal-results__label">实际天使</span>
                                <div class="reveal-results__person">
                                    ${pair.angel.avatar ? `<img alt="${escapeHtml(pair.angel.name)}" class="reveal-results__avatar" src="${pair.angel.avatar}" />` : ""}
                                    <span>${escapeHtml(pair.angel.name)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="reveal-results__meta-grid">
                            <div class="reveal-results__meta-block">
                                <span class="reveal-results__label">这位国王的愿望</span>
                                <div class="reveal-results__copy">${escapeHtml(pair.wishPreview || "该国王本轮愿望暂未同步。")}</div>
                            </div>
                            <div class="reveal-results__meta-block">
                                <span class="reveal-results__label">这位国王猜的天使</span>
                                ${pair.guessedAngelName ? `
                                    <div class="reveal-results__person">
                                        ${pair.guessedAngelAvatar ? `<img alt="${escapeHtml(pair.guessedAngelName)}" class="reveal-results__avatar" src="${pair.guessedAngelAvatar}" />` : ""}
                                        <span>${escapeHtml(pair.guessedAngelName)}</span>
                                    </div>
                                ` : `
                                    <div class="reveal-results__copy">这位国王还没提交猜测。</div>
                                `}
                            </div>
                        </div>
                    </article>
                `).join("")}
            </div>
        ` : `
            <div class="feed-list__state">
                <div class="feed-list__state-icon"><span class="material-icons-outlined">visibility</span></div>
                <h3>揭晓结果还没生成</h3>
                <p>管理员完成揭晓配对后，这里会直接展示每位国王的愿望、猜测和实际天使。</p>
            </div>
        `}
    </section>
`;

const buildStateCard = (icon, title, message, actionLabel = "", action = "") => `
    <div class="feed-list__state">
        <div class="feed-list__state-icon"><span class="material-icons-outlined">${icon}</span></div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        ${actionLabel ? `<button class="feed-list__state-action" data-feed-action="${action}" type="button">${escapeHtml(actionLabel)}</button>` : ""}
    </div>
`;

const buildPostCard = (post) => `
    <article class="feed-card" data-post-id="${post.id}">
        <div class="feed-card__header">
            <img alt="${escapeHtml(post.authorName)}" class="feed-card__avatar" src="${post.authorAvatar}" />
                <div class="feed-card__meta">
                    <div class="feed-card__author-row">
                        <span class="feed-card__author">${escapeHtml(post.authorName)}</span>
                        ${post.showAdminTag ? '<span class="feed-card__admin-tag">管理员</span>' : ""}
                        ${post.showOwnerBadge ? '<span class="feed-card__badge">频道主</span>' : ""}
                        ${post.showAdminReveal ? `
                            <div class="feed-card__admin-reveal">
                                <span class="feed-card__admin-reveal-label">真实身份</span>
                                <img alt="${escapeHtml(post.adminRevealIdentity.name)}" class="feed-card__admin-reveal-avatar" src="${post.adminRevealIdentity.avatar}" />
                                <span class="feed-card__admin-reveal-name">${escapeHtml(post.adminRevealIdentity.name)}</span>
                            </div>
                        ` : ""}
                    </div>
                    <div class="feed-card__time">${escapeHtml(post.timeLabel)}</div>
                    ${post.proxyWishSubmission ? `<div class="feed-card__proxy-note">${escapeHtml(post.proxyWishLabel)}</div>` : ""}
                </div>
                <div class="feed-card__header-actions">
                    ${post.canDelete ? '<button class="feed-card__header-action" data-feed-action="request-delete-post" type="button">删除</button>' : ""}
                </div>
        </div>
        <div class="feed-card__body">
            <div class="feed-card__body-text">${formatComposerTextForPost(post.previewText || "")}</div>
            ${post.showFullEntry ? '<button class="feed-card__full-entry" data-feed-action="open-post-body" type="button">全文</button>' : ""}
        </div>
        ${post.images.length ? `
            <div class="feed-card__media">
                ${post.images.map((image, index) => `
                    <button class="feed-card__image-shell" data-feed-action="open-image" data-image-index="${index}" type="button">
                        <img alt="${escapeHtml(image.name)}" class="feed-card__image" src="${image.url}" />
                    </button>
                `).join("")}
            </div>
        ` : ""}
        ${post.audioClips?.length ? `
            <div class="feed-card__audio-list">
                ${post.audioClips.map((clip) => `
                    <div class="feed-card__audio-shell">
                        <div class="feed-card__audio-meta">
                            <span class="material-icons-outlined">graphic_eq</span>
                            <span>${escapeHtml(clip.name || "语音")}</span>
                        </div>
                        <audio class="feed-card__audio-player" controls preload="metadata" src="${clip.url}"></audio>
                    </div>
                `).join("")}
            </div>
        ` : ""}
        ${post.canClaimWish ? `
            <div class="feed-card__claim-row">
                <button class="feed-card__claim-action ${post.isClaimedWish ? "is-selected" : ""}" data-feed-action="claim-wish" type="button">
                    ${escapeHtml(post.claimActionLabel)}
                </button>
            </div>
        ` : ""}
        <div class="feed-card__footer">
            <button class="feed-card__action ${post.isLiked ? "is-active" : ""}" data-feed-action="like-post" type="button">
                <span class="material-icons-outlined">${post.isLiked ? "favorite" : "favorite_border"}</span>
                <span>${post.likes > 0 ? post.likes : "点赞"}</span>
            </button>
            <button class="feed-card__action" data-feed-action="open-comments" type="button">
                <span class="material-icons-outlined">chat_bubble_outline</span>
                <span>${post.comments.length > 0 ? post.comments.length : "评论"}</span>
            </button>
            <button class="feed-card__action" type="button">
                <span class="material-icons-outlined">share</span>
                <span>${post.shares > 0 ? post.shares : "分享"}</span>
            </button>
        </div>
    </article>
`;

const buildStageHeader = (header) => `
    <header class="feed-list__stage-header">
        <div class="feed-list__stage-eyebrow">${escapeHtml(header.eyebrow)}</div>
        <h3 class="feed-list__stage-title">${escapeHtml(header.title)}</h3>
        <p class="feed-list__stage-description">${escapeHtml(header.description)}</p>
    </header>
`;

export const feedListTemplate = (vm) => {
    const content = vm.mode === "guess-picker"
        ? buildGuessPicker(vm)
        : vm.mode === "archived-claim-summary"
            ? buildArchivedClaimSummary(vm)
        : vm.mode === "archived-guess-summary"
            ? buildArchivedGuessSummary(vm)
        : vm.mode === "reveal-results"
            ? buildRevealResults(vm)
        : vm.status === "loading"
            ? buildStateCard("hourglass_top", "正在加载内容", "正在拉取频道内容，请稍候。")
            : vm.status === "error"
                ? buildStateCard("wifi_off", "内容加载失败", vm.error || "频道内容加载失败，请重试。", "重新加载", "retry")
                : vm.status === "empty"
                    ? buildStateCard("forum", "频道里还没有内容", "第一条帖子还没出现，可以直接发一条把频道跑起来。")
                    : vm.status === "search-empty"
                        ? buildStateCard("search_off", "本频道内没有搜到内容", `没有找到和“${vm.searchQuery}”相关的帖子或评论。`)
                        : `
        <div class="feed-list__stack">
            ${vm.items.map((item) => buildPostCard(item)).join("")}
        </div>
    `;
    return `
        <div class="feed-list ${vm.mode === "guess-picker" ? "feed-list--guess" : ""} ${vm.mode === "reveal-results" ? "feed-list--reveal" : ""} ${vm.status === "empty" || vm.status === "search-empty" || vm.status === "loading" || vm.status === "error" ? "feed-list--state" : ""}">
            ${buildStageHeader(vm.stageHeader)}
            ${content}
        </div>
    `;
};
