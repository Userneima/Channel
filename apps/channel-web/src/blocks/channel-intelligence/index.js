import "./styles.css";
import { attachChannelIntelligenceEvents } from "./events.js";
import { selectChannelIntelligenceVM } from "./selectors.js";
import {
    channelIntelligenceArchiveDialogTemplate,
    channelIntelligenceTemplate
} from "./template.js";

export const mountChannelIntelligenceBlock = ({ root, dialogRoot = null, store, actions }) => {
    let refs = null;
    let hasBoundEvents = false;
    let previousVM = null;
    let isComposing = false;

    const ensureRefs = () => {
        refs = {
            themeInput: root.querySelector("[data-channel-intelligence-ref='theme-input']")
        };

        if (!hasBoundEvents) {
            attachChannelIntelligenceEvents({
                root,
                roots: [root, dialogRoot].filter(Boolean),
                actions
            });
            root.addEventListener("compositionstart", (event) => {
                if (event.target.closest("[data-channel-intelligence-ref='theme-input']")) {
                    isComposing = true;
                }
            });
            root.addEventListener("compositionend", () => {
                isComposing = false;
            });
            hasBoundEvents = true;
        }
    };

    const getArchiveSignature = (archives = []) => JSON.stringify(
        archives.map((archive) => ({
            id: archive.id,
            title: archive.displayTitle || archive.title || archive.theme || "",
            completedAt: archive.completedAt || archive.createdAt || "",
            pairCount: archive.stats?.pairCount || archive.revealPairs?.length || 0,
            selected: Boolean(archive.isSelected)
        }))
    );

    const shouldRerender = (vm) => {
        if (!previousVM || root.innerHTML === "") {
            return true;
        }

        return previousVM.godPickerOpen !== vm.godPickerOpen
            || previousVM.themeEditorOpen !== vm.themeEditorOpen
            || previousVM.wishDeadlineEditorOpen !== vm.wishDeadlineEditorOpen
            || previousVM.wishDeadlineDisplay !== vm.wishDeadlineDisplay
            || previousVM.wishDeadlineRelativeLabel !== vm.wishDeadlineRelativeLabel
            || previousVM.wishDeadlineDraftValue !== vm.wishDeadlineDraftValue
            || previousVM.wishDeadlineButtonLabel !== vm.wishDeadlineButtonLabel
            || previousVM.revealEditorOpen !== vm.revealEditorOpen
            || previousVM.revealMemberPickerOpen !== vm.revealMemberPickerOpen
            || previousVM.revealAngelPickerOpen !== vm.revealAngelPickerOpen
            || previousVM.currentTheme !== vm.currentTheme
            || previousVM.hasTheme !== vm.hasTheme
            || previousVM.canManageRound !== vm.canManageRound
            || previousVM.canEditTheme !== vm.canEditTheme
            || previousVM.currentStageLabel !== vm.currentStageLabel
            || previousVM.currentTaskStageLabel !== vm.currentTaskStageLabel
            || previousVM.currentTaskLabel !== vm.currentTaskLabel
            || previousVM.currentDeadlineLabel !== vm.currentDeadlineLabel
            || previousVM.currentTaskStatus !== vm.currentTaskStatus
            || previousVM.currentTaskHint !== vm.currentTaskHint
            || previousVM.canArchiveRound !== vm.canArchiveRound
            || previousVM.canForceArchiveRound !== vm.canForceArchiveRound
            || previousVM.godProfile?.name !== vm.godProfile?.name
            || previousVM.godProfile?.avatar !== vm.godProfile?.avatar
            || previousVM.selectedArchive?.id !== vm.selectedArchive?.id
            || previousVM.selectedArchive?.title !== vm.selectedArchive?.title
            || previousVM.selectedArchive?.isRestorable !== vm.selectedArchive?.isRestorable
            || previousVM.archiveDetailOpen !== vm.archiveDetailOpen
            || previousVM.archiveDialogArchive?.id !== vm.archiveDialogArchive?.id
            || previousVM.archiveDialogArchive?.posts?.length !== vm.archiveDialogArchive?.posts?.length
            || previousVM.archiveViewerActive !== vm.archiveViewerActive
            || previousVM.draftRevealMember?.name !== vm.draftRevealMember?.name
            || previousVM.draftRevealAngel?.name !== vm.draftRevealAngel?.name
            || previousVM.revealResult?.actualName !== vm.revealResult?.actualName
            || previousVM.revealResult?.guessedName !== vm.revealResult?.guessedName
            || previousVM.showRevealSummary !== vm.showRevealSummary
            || previousVM.revealPairs.length !== vm.revealPairs.length
            || getArchiveSignature(previousVM.archives) !== getArchiveSignature(vm.archives);
    };

    return {
        render() {
            const vm = selectChannelIntelligenceVM(store.getState());
            const shouldRefocus = refs?.themeInput && document.activeElement === refs.themeInput;
            const selectionStart = shouldRefocus ? refs.themeInput.selectionStart ?? vm.draftTheme.length : vm.draftTheme.length;
            const selectionEnd = shouldRefocus ? refs.themeInput.selectionEnd ?? vm.draftTheme.length : vm.draftTheme.length;

            if (shouldRerender(vm)) {
                root.innerHTML = channelIntelligenceTemplate(vm);
                if (dialogRoot) {
                    dialogRoot.innerHTML = channelIntelligenceArchiveDialogTemplate(vm);
                }
                ensureRefs();

                if (shouldRefocus && refs?.themeInput && vm.themeEditorOpen) {
                    refs.themeInput.focus();
                    refs.themeInput.setSelectionRange(selectionStart, selectionEnd);
                }

                previousVM = vm;
                return;
            }

            if (dialogRoot && dialogRoot.innerHTML !== channelIntelligenceArchiveDialogTemplate(vm)) {
                dialogRoot.innerHTML = channelIntelligenceArchiveDialogTemplate(vm);
            }

            if (refs?.themeInput && document.activeElement !== refs.themeInput && !isComposing && refs.themeInput.value !== vm.draftTheme) {
                refs.themeInput.value = vm.draftTheme;
            }

            previousVM = vm;
        }
    };
};
