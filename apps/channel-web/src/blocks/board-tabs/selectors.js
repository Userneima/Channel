import { boardTabs, feedFilterChoices, getRoundStageIndex } from "../../entities/channel/config.js";

export const selectBoardTabsVM = (state, uiState = {}) => ({
    boards: boardTabs.map((board) => {
        if (board.value === "all") {
            return {
                ...board,
                disabled: false
            };
        }

        if (state.roundState.archiveViewerRoundId || state.roundState.lifecycleStatus === "archived") {
            return {
                ...board,
                disabled: false
            };
        }

        const isDemoMode = state.runtimeState.channel?.slug === "demo";
        const canManageRound = ["owner", "admin"].includes(state.runtimeState.realIdentity.role)
            && state.membershipState.status === "approved";
        const disabled = !isDemoMode
            && !canManageRound
            && getRoundStageIndex(board.value) > getRoundStageIndex(state.roundState.activeStage);

        return {
            ...board,
            disabled
        };
    }),
    filters: feedFilterChoices,
    activeBoard: state.feedState.activeBoard,
    activeFilter: state.feedState.activeFilter,
    topRegion: state.uiState.topRegion,
    filterMenuOpen: Boolean(uiState.filterMenuOpen),
    currentStageLabel: boardTabs.find((board) => board.value === state.roundState.activeStage)?.label || ""
});
