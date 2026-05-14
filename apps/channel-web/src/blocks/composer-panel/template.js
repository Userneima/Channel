import { escapeHtml } from "../../shared/lib/helpers.js";

const buildMentionMenu = (vm) => `
    <div class="composer-panel__mention-wrap">
        <button class="composer-panel__icon-button composer-panel__icon-button--toggle composer-panel__mention-trigger ${vm.mentionOpen ? "is-active" : ""} ${vm.mentionTarget ? "has-target" : ""}" data-composer-action="toggle-mention" type="button" title="${escapeHtml(vm.mentionTitle)}">
            <span class="material-icons-outlined">alternate_email</span>
        </button>
        <div class="composer-panel__mention-menu ${vm.mentionOpen ? "is-open" : ""}">
            <div class="composer-panel__mention-title">${escapeHtml(vm.mentionTitle)}</div>
            ${vm.mentionMembers.map((member) => `
                <button class="composer-panel__mention-option" data-mention-member-name="${escapeHtml(member.name)}" data-mention-member-avatar="${escapeHtml(member.avatar || "")}" type="button">
                    <img alt="${escapeHtml(member.name)}" class="composer-panel__mention-avatar" src="${member.avatar}" />
                    <span>${escapeHtml(member.name)}</span>
                </button>
            `).join("")}
        </div>
    </div>
`;

const buildProxyWishMenu = (vm) => `
    <div class="composer-panel__mention-wrap composer-panel__proxy-wrap">
        <button class="composer-panel__icon-button composer-panel__icon-button--toggle composer-panel__mention-trigger ${vm.proxyWishOpen ? "is-active" : ""} ${vm.proxyWishTarget ? "has-target" : ""}" data-composer-action="toggle-proxy-wish" type="button" title="代成员记录愿望">
            <span class="material-icons-outlined">person_add</span>
        </button>
        <div class="composer-panel__mention-menu ${vm.proxyWishOpen ? "is-open" : ""}">
            <div class="composer-panel__mention-title">代谁记录愿望</div>
            ${vm.proxyWishMembers.length ? vm.proxyWishMembers.map((member) => `
                <button class="composer-panel__mention-option" data-proxy-member-name="${escapeHtml(member.name)}" data-proxy-member-avatar="${escapeHtml(member.avatar || "")}" data-proxy-member-user-id="${escapeHtml(member.userId || "")}" data-proxy-member-identity-id="${escapeHtml(member.identityId || "")}" type="button">
                    <img alt="${escapeHtml(member.name)}" class="composer-panel__mention-avatar" src="${member.avatar}" />
                    <span>${escapeHtml(member.name)}</span>
                </button>
            `).join("") : `<div class="composer-panel__mention-empty">当前没有待补录的成员。</div>`}
        </div>
    </div>
`;

const buildRecordingButton = (vm, extraClass = "") => `
    <button class="composer-panel__icon-button composer-panel__icon-button--toggle ${extraClass} ${vm.audioRecording ? "is-active is-recording" : ""}" data-composer-action="toggle-recording" type="button" title="${vm.audioRecording ? "结束录音" : "开始录音"}">
        <span class="material-icons-outlined">${vm.audioRecording ? "stop_circle" : "mic"}</span>
    </button>
`;

const buildEmojiMenu = (vm) => `
    <div class="composer-panel__emoji-wrap">
        <button class="composer-panel__icon-button composer-panel__icon-button--toggle ${vm.emojiOpen ? "is-active" : ""}" data-composer-action="toggle-emoji" type="button" title="表情">
            <span class="material-icons-outlined">sentiment_satisfied_alt</span>
        </button>
        <div class="composer-panel__emoji-menu ${vm.emojiOpen ? "is-open" : ""}">
            ${vm.emojiGroups.map((group) => `
                <section class="composer-panel__emoji-group">
                    <div class="composer-panel__emoji-group-title">${escapeHtml(group.label)}</div>
                    <div class="composer-panel__emoji-items">
                        ${group.items.map((emoji) => `
                            <button class="composer-panel__emoji-option" data-emoji-value="${escapeHtml(emoji)}" type="button">${escapeHtml(emoji)}</button>
                        `).join("")}
                    </div>
                </section>
            `).join("")}
        </div>
    </div>
`;

const buildAudioDraft = (vm) => vm.audioDraft ? `
    <div class="composer-panel__audio-draft">
        <div class="composer-panel__audio-draft-copy">
            <span class="material-icons-outlined">graphic_eq</span>
            <span>${escapeHtml(vm.audioDraft.name || "语音")}</span>
        </div>
        <audio class="composer-panel__audio-player" controls preload="metadata" src="${vm.audioDraft.url}"></audio>
        <button class="composer-panel__remove-audio" data-composer-action="remove-audio" type="button" aria-label="删除语音">
            <span class="material-icons-outlined">close</span>
        </button>
    </div>
` : "";

export const composerPanelTemplate = (vm) => `
    <div class="composer-panel ${vm.hideInlineComposer ? "composer-panel--hidden" : ""}">
        ${vm.hideInlineComposer ? `` : !vm.canCompose ? `
            <div class="composer-panel__row composer-panel__row--disabled">
                <button class="composer-panel__identity" type="button">
                    <img alt="${escapeHtml(vm.identityDisplay.name)}" class="composer-panel__avatar" src="${vm.identityDisplay.avatar}" />
                </button>
                <label class="composer-panel__field">
                    <span class="sr-only">帖子内容</span>
                    <textarea class="composer-panel__textarea composer-panel__textarea--disabled" disabled placeholder="${escapeHtml(vm.gate.placeholder || vm.placeholder)}"></textarea>
                </label>
                <div class="composer-panel__icons composer-panel__icons--disabled">
                    <button class="composer-panel__icon-button" disabled type="button">
                        <span class="material-icons-outlined">sentiment_satisfied_alt</span>
                    </button>
                    <button class="composer-panel__icon-button composer-panel__icon-button--toggle ${vm.anonymousMode ? "is-active" : ""}" disabled type="button" title="进入频道后即可使用匿名发言">
                        <span class="material-icons-outlined">alternate_email</span>
                    </button>
                    <button class="composer-panel__icon-button" disabled type="button">
                        <span class="material-icons-outlined">image</span>
                    </button>
                    <button class="composer-panel__icon-button" disabled type="button">
                        <span class="material-icons-outlined">campaign</span>
                    </button>
                </div>
            </div>
            <div class="composer-panel__disabled-tip ${vm.gate?.primaryAction && vm.gate?.primaryLabel ? "composer-panel__disabled-tip--with-action" : ""}">
                <span class="composer-panel__disabled-tip-copy">${escapeHtml(vm.gate?.description || "登录后即可参与频道。")}</span>
                ${vm.gate?.primaryAction && vm.gate?.primaryLabel ? `
                    <button class="composer-panel__disabled-primary" data-composer-action="${escapeHtml(vm.gate.primaryAction)}" type="button">${escapeHtml(vm.gate.primaryLabel)}</button>
                ` : ""}
            </div>
        ` : !vm.stageAllowsPosting ? `
            <div class="composer-panel__row composer-panel__row--disabled">
                <button class="composer-panel__identity" type="button">
                    <img alt="${escapeHtml(vm.identityDisplay.name)}" class="composer-panel__avatar" src="${vm.identityDisplay.avatar}" />
                </button>
                <div class="composer-panel__stage-lock">
                    <div class="composer-panel__stage-lock-title">${escapeHtml(vm.stageInfo.label)}阶段暂不发帖</div>
                    <div class="composer-panel__stage-lock-copy">${escapeHtml(vm.stageInfo.helperText)}</div>
                    ${vm.isClaimStage && vm.claimSelection ? `
                        <div class="composer-panel__claim-card">
                            <div class="composer-panel__claim-label">当前已选愿望</div>
                            <div class="composer-panel__claim-author">
                                <img alt="${escapeHtml(vm.claimSelection.authorName)}" class="composer-panel__mention-avatar" src="${vm.claimSelection.authorAvatar}" />
                                <span>${escapeHtml(vm.claimSelection.authorName)}</span>
                            </div>
                            <div class="composer-panel__claim-preview">${escapeHtml(vm.claimSelection.previewText)}</div>
                        </div>
                    ` : vm.isClaimStage ? `
                        <div class="composer-panel__claim-empty">从下方愿望列表里选 1 条，交付阶段会自动带上目标。</div>
                    ` : vm.isRevealStage && vm.revealResult ? `
                        <div class="composer-panel__claim-card composer-panel__claim-card--reveal">
                            <div class="composer-panel__claim-label">我的揭晓结果</div>
                            <div class="composer-panel__claim-preview">你猜的是 ${escapeHtml(vm.revealResult.guessedName || "未提交猜测")}，实际天使是 ${escapeHtml(vm.revealResult.actualName)}。</div>
                            <div class="composer-panel__claim-label">${vm.revealResult.isCorrect ? "这次猜中了。" : "这次没猜中。"}</div>
                        </div>
                    ` : vm.isRevealStage ? `
                        <div class="composer-panel__claim-empty">管理员还没完成这轮揭晓配对，结果会在这里直接显示。</div>
                    ` : ""}
                </div>
            </div>
        ` : `
        <div class="composer-panel__compose-shell ${vm.expanded ? "is-expanded" : "is-collapsed"}">
            ${!vm.expanded ? `
                <div class="composer-panel__collapsed-row">
                    <button class="composer-panel__identity" data-composer-action="open-identity" type="button">
                        <img alt="${escapeHtml(vm.identityDisplay.name)}" class="composer-panel__avatar" data-ref="identity-avatar" src="${vm.identityDisplay.avatar}" />
                        <span class="composer-panel__identity-name" data-ref="identity-name">${escapeHtml(vm.identityDisplay.name)}</span>
                    </button>
                    <button class="composer-panel__collapsed-field" data-composer-action="expand" type="button">
                        <span class="composer-panel__collapsed-placeholder ${vm.hasDraft ? "has-draft" : ""}">${escapeHtml(vm.collapsedSummary)}</span>
                    </button>
                    ${vm.isDeliveryStage && vm.mentionTarget ? `
                        <div class="composer-panel__mention-chip composer-panel__mention-chip--collapsed">
                            <span class="composer-panel__mention-chip-label">To</span>
                            <img alt="${escapeHtml(vm.mentionTarget.name)}" class="composer-panel__mention-avatar" src="${vm.mentionTarget.avatar}" />
                            <span>${escapeHtml(vm.mentionTarget.name)}</span>
                        </div>
                    ` : vm.proxyWishTarget ? `
                        <div class="composer-panel__mention-chip composer-panel__mention-chip--collapsed">
                            <span class="composer-panel__mention-chip-label">代录</span>
                            <img alt="${escapeHtml(vm.proxyWishTarget.name)}" class="composer-panel__mention-avatar" src="${vm.proxyWishTarget.avatar}" />
                            <span>${escapeHtml(vm.proxyWishTarget.name)}</span>
                        </div>
                    ` : ""}
                    <div class="composer-panel__tools composer-panel__tools--collapsed">
                        ${vm.stageInfo.requiresMention && vm.canChooseMentionTarget ? buildMentionMenu(vm) : ""}
                        ${vm.canProxyWish ? buildProxyWishMenu(vm) : ""}
                        ${vm.anonymousLocked ? "" : `
                            <button class="composer-panel__mode-toggle ${vm.anonymousMode ? "is-active" : ""}" data-composer-action="toggle-anonymous" type="button" title="匿名发言">
                                <span>匿名</span>
                            </button>
                        `}
                        ${buildRecordingButton(vm)}
                        <label class="composer-panel__icon-button composer-panel__file-trigger" title="插入图片">
                            <span class="material-icons-outlined">image</span>
                            <input accept="image/*" class="sr-only" data-ref="image-input" multiple type="file" />
                        </label>
                    </div>
                </div>
            ` : `
            <div class="composer-panel__topbar">
                <button class="composer-panel__identity" data-composer-action="open-identity" type="button">
                    <img alt="${escapeHtml(vm.identityDisplay.name)}" class="composer-panel__avatar" data-ref="identity-avatar" src="${vm.identityDisplay.avatar}" />
                    <span class="composer-panel__identity-name" data-ref="identity-name">${escapeHtml(vm.identityDisplay.name)}</span>
                </button>
                <div class="composer-panel__tools">
                    ${buildEmojiMenu(vm)}
                    ${vm.stageInfo.requiresMention && vm.canChooseMentionTarget ? buildMentionMenu(vm) : ""}
                    ${vm.canProxyWish ? buildProxyWishMenu(vm) : ""}
                    ${vm.anonymousLocked ? "" : `
                        <button class="composer-panel__mode-toggle ${vm.anonymousMode ? "is-active" : ""}" data-composer-action="toggle-anonymous" type="button" title="匿名发言">
                            <span>匿名</span>
                        </button>
                    `}
                    <label class="composer-panel__icon-button composer-panel__file-trigger" title="插入图片">
                        <span class="material-icons-outlined">image</span>
                        <input accept="image/*" class="sr-only" data-ref="image-input" multiple type="file" />
                    </label>
                    ${!vm.anonymousMode && !vm.anonymousLocked ? `
                        <div class="composer-panel__disclosure-wrap">
                            <button class="composer-panel__icon-button composer-panel__icon-button--toggle ${vm.aiDisclosureOpen ? "is-active" : ""}" data-composer-action="toggle-ai-disclosure" type="button" title="自主声明">
                                <span class="material-icons-outlined">campaign</span>
                            </button>
                            <div class="composer-panel__disclosure-menu ${vm.aiDisclosureOpen ? "is-open" : ""}">
                                <div class="composer-panel__disclosure-title">自主声明</div>
                                ${vm.aiDisclosureChoices.map((choice) => `
                                    <button class="composer-panel__disclosure-option ${choice.value === vm.aiDisclosure ? "is-active" : ""}" data-ai-disclosure-value="${choice.value}" type="button">
                                        <span>${escapeHtml(choice.label)}</span>
                                        ${choice.value === vm.aiDisclosure ? `<span class="material-icons-outlined">done</span>` : ""}
                                    </button>
                                `).join("")}
                            </div>
                        </div>
                    ` : ""}
                    ${vm.anonymousMode ? `
                        <button class="composer-panel__icon-button" data-composer-action="rotate-alias" type="button" title="换马甲">
                            <span class="material-icons-outlined">autorenew</span>
                        </button>
                    ` : ""}
                    ${buildRecordingButton(vm)}
                    <button class="composer-panel__icon-button" data-composer-action="collapse" type="button" title="收起">
                        <span class="material-icons-outlined">close</span>
                    </button>
                </div>
            </div>
            ${vm.anonymousMode ? `
                <div class="composer-panel__anonymous-panel">
                    <div class="composer-panel__anonymous-card composer-panel__anonymous-card--controls">
                            <div class="composer-panel__anonymous-copy composer-panel__anonymous-copy--controls">
                            <div class="composer-panel__anonymous-head">
                                <label class="composer-panel__anonymous-checkbox">
                                    <input ${vm.anonymousTextRewrite ? "checked" : ""} data-ref="anonymous-text-rewrite" type="checkbox" />
                                    <span>AI 润色文本</span>
                                </label>
                                <label class="composer-panel__anonymous-checkbox">
                                    <input ${vm.aiImageReshape ? "checked" : ""} data-ref="ai-image-reshape" type="checkbox" />
                                    <span>AI 重塑图片</span>
                                </label>
                                <div class="composer-panel__anonymous-help">
                                    <button class="composer-panel__anonymous-help-trigger" type="button" title="匿名说明">
                                        <span class="material-icons-outlined">help_outline</span>
                                    </button>
                                    <div class="composer-panel__anonymous-help-popover">
                                        <p>普通成员只会看到这层马甲，管理员可切换到真实身份视角。</p>
                                        <p>匿名发出后会自动刷新成下一张马甲。</p>
                                        <p>如果打开 AI 润色，会先给你一版可预览的文本，再决定是否发出。</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="composer-panel__anonymous-preview ${vm.showAnonymousTextPreview ? "" : "is-hidden"} ${vm.anonymousPreviewStatus === "loading" ? "is-loading" : ""}" data-ref="anonymous-preview">
                            <div class="composer-panel__anonymous-preview-label">${vm.anonymousPreviewStatus === "loading" ? "AI 润色中" : "AI 润色预览"}</div>
                            <div class="composer-panel__anonymous-preview-body" data-ref="anonymous-preview-body">${escapeHtml(vm.anonymousPreviewDisplayText)}</div>
                        </div>
                    </div>
                </div>
            ` : ""}
            <div class="composer-panel__editor">
                <div class="composer-panel__stage-note">
                    <span class="composer-panel__stage-note-title">${escapeHtml(vm.stageInfo.label)}阶段</span>
                </div>
                ${vm.proxyWishTarget ? `
                    <div class="composer-panel__mention-chip">
                        <span class="composer-panel__mention-chip-label">代录</span>
                        <img alt="${escapeHtml(vm.proxyWishTarget.name)}" class="composer-panel__mention-avatar" src="${vm.proxyWishTarget.avatar}" />
                        <span>${escapeHtml(vm.proxyWishTarget.name)}</span>
                        <button class="composer-panel__mention-clear" data-composer-action="clear-proxy-wish" type="button" aria-label="清除代录对象">
                            <span class="material-icons-outlined">close</span>
                        </button>
                    </div>
                ` : ""}
                ${vm.isDeliveryStage && vm.claimSelection ? `
                    <div class="composer-panel__claim-card composer-panel__claim-card--compact">
                        <div class="composer-panel__claim-preview">${escapeHtml(vm.claimSelection.previewText)}</div>
                    </div>
                ` : vm.isDeliveryStage ? `
                    <div class="composer-panel__claim-empty">先到「选愿望」阶段锁定 1 条愿望，再回来交付。</div>
                ` : ""}
                ${vm.mentionTarget ? `
                    <div class="composer-panel__mention-chip">
                        <span class="composer-panel__mention-chip-label">To</span>
                        <img alt="${escapeHtml(vm.mentionTarget.name)}" class="composer-panel__mention-avatar" src="${vm.mentionTarget.avatar}" />
                        <span>${escapeHtml(vm.mentionTarget.name)}</span>
                        ${vm.canChooseMentionTarget ? `
                            <button class="composer-panel__mention-clear" data-composer-action="clear-mention" type="button" aria-label="清除目标成员">
                                <span class="material-icons-outlined">close</span>
                            </button>
                        ` : ""}
                    </div>
                ` : ""}
                <label class="composer-panel__field composer-panel__field--expanded">
                    <span class="sr-only">帖子内容</span>
                    <textarea class="composer-panel__textarea composer-panel__textarea--expanded" data-ref="draft-input" placeholder="${escapeHtml(vm.placeholder)}">${escapeHtml(vm.draftText)}</textarea>
                </label>
                ${vm.audioRecording ? `
                    <div class="composer-panel__recording-status">
                        <span class="material-icons-outlined">mic</span>
                        <span>录音中，再点一次麦克风结束录音</span>
                    </div>
                ` : ""}
                <div class="composer-panel__media-row">
                    ${buildAudioDraft(vm)}
                    <div class="composer-panel__media-grid">
                        <label class="composer-panel__add-tile">
                            <span class="material-icons-outlined">add</span>
                            <input accept="image/*" class="sr-only" data-ref="image-input-secondary" multiple type="file" />
                        </label>
                        <div class="composer-panel__image-list" data-ref="image-list"></div>
                    </div>
                    <div class="composer-panel__footer composer-panel__footer--expanded">
                        <div class="composer-panel__footer-right">
                            <div class="composer-panel__count" data-ref="char-count">${vm.charCount}/1000</div>
                            <button class="composer-panel__submit" data-ref="submit-button" ${vm.canSubmit ? "" : "disabled"} type="button">${escapeHtml(vm.submitLabel)}</button>
                        </div>
                    </div>
                </div>
            </div>
            `}
        </div>
        `}
    </div>
`;
