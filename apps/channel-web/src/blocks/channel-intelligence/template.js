import { escapeHtml } from "../../shared/lib/helpers.js";

const buildGodPicker = (vm) => `
    <div class="channel-intelligence__picker ${vm.godPickerOpen ? "is-open" : ""}">
        ${vm.godOptions.map((member) => `
            <button class="channel-intelligence__picker-option" data-channel-intelligence-god="${escapeHtml(member.name)}" data-channel-intelligence-avatar="${escapeHtml(member.avatar || "")}" data-channel-intelligence-user-id="${escapeHtml(member.userId || "")}" type="button">
                <img alt="${escapeHtml(member.name)}" class="channel-intelligence__picker-avatar" src="${member.avatar}" />
                <span>${escapeHtml(member.name)}</span>
            </button>
        `).join("")}
    </div>
`;

const buildThemeEditor = (vm) => `
    <div class="channel-intelligence__theme-editor ${vm.themeEditorOpen ? "is-open" : ""}">
        <input class="channel-intelligence__theme-input" data-channel-intelligence-ref="theme-input" maxlength="24" placeholder="输入本周主题" type="text" value="${escapeHtml(vm.draftTheme)}" />
        <div class="channel-intelligence__theme-actions">
            <button class="channel-intelligence__action-button is-quiet" data-channel-intelligence-action="cancel-theme" type="button">取消</button>
            <button class="channel-intelligence__action-button" data-channel-intelligence-action="save-theme" type="button">保存主题</button>
        </div>
    </div>
`;

const buildDeadlineEditor = (vm) => `
    <div class="channel-intelligence__theme-editor ${vm.wishDeadlineEditorOpen ? "is-open" : ""}">
        <input class="channel-intelligence__theme-input" data-channel-intelligence-ref="wish-deadline-input" type="datetime-local" value="${escapeHtml(vm.wishDeadlineDraftValue)}" />
        <div class="channel-intelligence__theme-actions">
            <button class="channel-intelligence__action-button is-quiet" data-channel-intelligence-action="cancel-deadline" type="button">取消</button>
            <button class="channel-intelligence__action-button" data-channel-intelligence-action="save-deadline" type="button">保存截止</button>
        </div>
    </div>
`;

const buildRevealSummary = (vm) => `
    <div class="channel-intelligence__reveal-block">
        <div class="channel-intelligence__round-row is-with-action">
            <div class="channel-intelligence__round-copy">
                <span class="channel-intelligence__round-label">揭晓结果</span>
                <div class="channel-intelligence__round-value">
                    ${vm.revealResult
        ? `你猜的是 ${escapeHtml(vm.revealResult.guessedName || "未提交猜测")}，实际天使是 ${escapeHtml(vm.revealResult.actualName)}。`
        : vm.revealPairs.length
            ? `已生成 ${escapeHtml(vm.revealPairs.length)} 对揭晓结果。`
            : "还没生成揭晓结果。"}
                </div>
            </div>
            ${vm.canManageRound ? `
                <button class="channel-intelligence__action-button is-quiet" data-channel-intelligence-action="generate-reveal-results" type="button">
                    ${vm.revealPairs.length ? "重新生成揭晓" : "一键生成揭晓"}
                </button>
            ` : ""}
        </div>
        ${vm.revealPairs.length ? `<div class="channel-intelligence__reveal-meta">系统会根据交付帖里的 To 对象和匿名作者真实身份自动生成配对。</div>` : ""}
    </div>
`;

const buildArchiveDetail = (archive) => archive ? `
    <div class="channel-intelligence__archive-detail">
        <div class="channel-intelligence__archive-stats">
            <div class="channel-intelligence__archive-stat">
                <span class="channel-intelligence__round-label">参与人数</span>
                <strong>${escapeHtml(archive.stats?.totalMembers || 0)}</strong>
            </div>
            <div class="channel-intelligence__archive-stat">
                <span class="channel-intelligence__round-label">猜测完成</span>
                <strong>${escapeHtml(archive.stats?.guessDone || 0)}</strong>
            </div>
            <div class="channel-intelligence__archive-stat">
                <span class="channel-intelligence__round-label">揭晓配对</span>
                <strong>${escapeHtml(archive.stats?.pairCount || archive.revealPairs.length)}</strong>
            </div>
        </div>
        <h4 class="channel-intelligence__section-title">揭晓配对</h4>
        <div class="channel-intelligence__archive-pairs">
            ${(archive.revealPairs || []).map((pair) => `
                <article class="channel-intelligence__archive-pair">
                    <div class="channel-intelligence__archive-pair-head">
                        <div class="channel-intelligence__archive-person">
                            ${pair.member?.avatar ? `<img alt="${escapeHtml(pair.member.name)}" class="channel-intelligence__round-avatar" src="${pair.member.avatar}" />` : ""}
                            <span>${escapeHtml(pair.member?.name || "国王")}</span>
                        </div>
                        <span class="channel-intelligence__archive-arrow">→</span>
                        <div class="channel-intelligence__archive-person">
                            ${pair.angel?.avatar ? `<img alt="${escapeHtml(pair.angel.name)}" class="channel-intelligence__round-avatar" src="${pair.angel.avatar}" />` : ""}
                            <span>${escapeHtml(pair.angel?.name || "天使")}</span>
                        </div>
                    </div>
                    <div class="channel-intelligence__archive-copy">${escapeHtml(pair.wishPreview || "这位国王的愿望摘要还没保存进归档。")}</div>
                    <div class="channel-intelligence__archive-guess">猜的是：${escapeHtml(pair.guessedAngelName || "未提交猜测")}</div>
                </article>
            `).join("")}
        </div>
        ${archive.forceArchiveReason ? `
            <div class="channel-intelligence__archive-copy">强制归档原因：${escapeHtml(archive.forceArchiveReason)}</div>
        ` : ""}
    </div>
` : "";

const boardLabels = {
    all: "闲聊",
    wish: "许愿",
    delivery: "交付",
    guess: "猜测",
    reveal: "揭晓",
    archive: "归档"
};

const buildArchivePosts = (archive) => {
    const posts = Array.isArray(archive?.posts) ? archive.posts : [];
    if (!posts.length) {
        return `<div class="channel-intelligence__archive-empty">这个归档暂时没有保存帖子明细。</div>`;
    }

    return `
        <div class="channel-intelligence__archive-posts">
            ${posts.map((post) => `
                <article class="channel-intelligence__archive-post">
                    <div class="channel-intelligence__archive-post-head">
                        <span>${escapeHtml(boardLabels[post.board] || post.board || "内容")}</span>
                        <span>${escapeHtml(post.authorName || post.adminRevealIdentity?.name || "匿名成员")}</span>
                    </div>
                    <div class="channel-intelligence__archive-copy">${escapeHtml(post.body || "这条内容没有正文。")}</div>
                    ${(post.comments || []).length ? `
                        <div class="channel-intelligence__archive-comments">
                            ${(post.comments || []).map((comment) => `
                                <div class="channel-intelligence__archive-comment">
                                    <span>${escapeHtml(comment.authorName || "评论者")}</span>
                                    <p>${escapeHtml(comment.body || "")}</p>
                                </div>
                            `).join("")}
                        </div>
                    ` : ""}
                </article>
            `).join("")}
        </div>
    `;
};

export const channelIntelligenceArchiveDialogTemplate = (vm) => vm.archiveDetailOpen && vm.archiveDialogArchive ? `
    <div class="channel-intelligence-dialog is-open" data-channel-intelligence-dialog="archive-detail" role="dialog" aria-modal="true" aria-label="往期回合详情">
        <button class="channel-intelligence-dialog__backdrop" data-channel-intelligence-action="close-archive-detail" type="button" aria-label="关闭归档详情"></button>
        <article class="channel-intelligence-dialog__panel">
            <header class="channel-intelligence-dialog__header">
                <div>
                    <h3>${escapeHtml(vm.archiveDialogArchive.displayTitle)}</h3>
                    <p>${escapeHtml(vm.archiveDialogArchive.metaLine)}</p>
                    ${vm.archiveDialogArchive.archiveMode ? `
                        <div class="channel-intelligence-dialog__metrics">${escapeHtml(
        vm.archiveDialogArchive.archiveMode === "forced"
            ? "强制归档"
            : vm.archiveDialogArchive.archiveMode === "pre_restore"
                ? "恢复前快照"
                : vm.archiveDialogArchive.archiveMode === "legacy_summary"
                    ? "仅摘要"
                    : "正常归档"
    )}</div>
                    ` : ""}
                </div>
                <button class="channel-intelligence-dialog__close" data-channel-intelligence-action="close-archive-detail" type="button" aria-label="关闭">×</button>
            </header>
            <div class="channel-intelligence-dialog__body">
                <div class="channel-intelligence__archive-actions">
                    ${vm.canManageRound ? `
                        <button class="channel-intelligence__action-button is-quiet" data-channel-intelligence-action="rename-archive" type="button">改标题</button>
                    ` : ""}
                    ${vm.archiveDialogArchive.isRestorable ? `
                        <button class="channel-intelligence__action-button" data-channel-intelligence-action="restore-archive" type="button">恢复为当前</button>
                    ` : ""}
                    <button class="channel-intelligence__action-button is-quiet" data-channel-intelligence-action="export-archive" type="button">导出备份</button>
                    <button class="channel-intelligence__action-button is-quiet" data-channel-intelligence-action="view-archive-board" type="button">按板块查看</button>
                    ${vm.archiveViewerActive ? `
                        <button class="channel-intelligence__action-button is-quiet" data-channel-intelligence-action="exit-archive-viewer" type="button">返回当前回合</button>
                    ` : ""}
                    ${vm.canManageRound ? `
                        <button class="channel-intelligence__action-button is-danger" data-channel-intelligence-action="delete-archive" type="button">删除记录</button>
                    ` : ""}
                </div>
                ${vm.selectedArchiveViewOnlyLabel ? `
                    <div class="channel-intelligence__archive-hint">${escapeHtml(vm.selectedArchiveViewOnlyLabel)}</div>
                ` : ""}
                ${buildArchiveDetail(vm.archiveDialogArchive)}
                <section class="channel-intelligence__section">
                    <h4 class="channel-intelligence__section-title">帖子与评论</h4>
                    ${buildArchivePosts(vm.archiveDialogArchive)}
                </section>
            </div>
        </article>
    </div>
` : "";

export const channelIntelligenceTemplate = (vm) => `
    <section class="channel-intelligence">
        <header class="channel-intelligence__header">
            <section class="channel-intelligence__round">
                <div class="channel-intelligence__round-head">
                    <div>
                        <h3>当前回合</h3>
                        <div class="channel-intelligence__round-meta">${escapeHtml(vm.currentRoundDisplayTitle)}</div>
                    </div>
                    ${vm.canRenameCurrentRound ? `
                        <button class="channel-intelligence__action-button is-quiet" data-channel-intelligence-action="rename-current-round" type="button">改轮次名</button>
                    ` : ""}
                </div>
                <div class="channel-intelligence__round-row ${vm.canManageRound ? "is-with-action" : ""}">
                    <div class="channel-intelligence__round-copy">
                        <span class="channel-intelligence__round-label">本周上帝</span>
                        <div class="channel-intelligence__round-value ${vm.godProfile ? "has-avatar" : ""}">
                            ${vm.godProfile ? `<img alt="${escapeHtml(vm.godProfile.name)}" class="channel-intelligence__round-avatar" src="${vm.godProfile.avatar}" />` : ""}
                            <span>${escapeHtml(vm.godProfile?.name || "待指定")}</span>
                        </div>
                    </div>
                    ${vm.canManageRound ? `
                        <button class="channel-intelligence__action-button is-quiet" data-channel-intelligence-action="toggle-god-picker" type="button">指定上帝</button>
                    ` : ""}
                </div>
                ${vm.canManageRound ? buildGodPicker(vm) : ""}
                <div class="channel-intelligence__round-row ${vm.canEditTheme ? "is-with-action" : ""}">
                    <div class="channel-intelligence__round-copy">
                        <span class="channel-intelligence__round-label">当前主题</span>
                        <div class="channel-intelligence__round-value">${escapeHtml(vm.currentTheme)}</div>
                    </div>
                    ${vm.canEditTheme ? `
                        <button class="channel-intelligence__action-button is-quiet" data-channel-intelligence-action="toggle-theme-editor" type="button">${vm.hasTheme ? "修改主题" : "设定主题"}</button>
                    ` : ""}
                </div>
                ${vm.canEditTheme ? buildThemeEditor(vm) : ""}
                <div class="channel-intelligence__round-row">
                    <span class="channel-intelligence__round-label">当前阶段</span>
                    <div class="channel-intelligence__round-value">${escapeHtml(vm.currentStageLabel)}</div>
                </div>
                <div class="channel-intelligence__round-row ${vm.canManageRound ? "is-with-action" : ""}">
                    <div class="channel-intelligence__round-copy">
                        <span class="channel-intelligence__round-label">许愿截止</span>
                        <div class="channel-intelligence__round-value">${escapeHtml(vm.wishDeadlineDisplay)}</div>
                        <div class="channel-intelligence__round-meta">${escapeHtml(vm.wishDeadlineRelativeLabel)}</div>
                    </div>
                    ${vm.canManageRound ? `
                        <button class="channel-intelligence__action-button is-quiet" data-channel-intelligence-action="toggle-deadline-editor" type="button">${escapeHtml(vm.wishDeadlineButtonLabel)}</button>
                    ` : ""}
                </div>
                ${vm.canManageRound ? buildDeadlineEditor(vm) : ""}
                ${vm.canManageRound ? `
                    <div class="channel-intelligence__round-actions">
                        <button class="channel-intelligence__action-button ${vm.canArchiveRound ? "" : "is-disabled"}" data-channel-intelligence-action="archive-current-round" ${vm.canArchiveRound ? "" : "disabled"} type="button">归档本轮</button>
                        <button class="channel-intelligence__action-button is-quiet ${vm.canForceArchiveRound ? "" : "is-disabled"}" data-channel-intelligence-action="force-archive-current-round" ${vm.canForceArchiveRound ? "" : "disabled"} type="button">强制归档</button>
                    </div>
                ` : ""}
                ${vm.showRevealSummary ? buildRevealSummary(vm) : ""}
            </section>
            <section class="channel-intelligence__task">
                <div class="channel-intelligence__task-head">
                    <span>我的待办</span>
                    <span>${escapeHtml(vm.currentTaskStatus)}</span>
                </div>
                <div class="channel-intelligence__task-title">${escapeHtml(vm.currentTaskTitle)}</div>
                ${vm.currentTaskMeta ? `<div class="channel-intelligence__task-meta">${escapeHtml(vm.currentTaskMeta)}</div>` : ""}
                ${vm.currentTaskHint ? `<div class="channel-intelligence__task-hint">${escapeHtml(vm.currentTaskHint)}</div>` : ""}
            </section>
        </header>
    </section>
`;
