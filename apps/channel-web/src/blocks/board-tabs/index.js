import "./styles.css";
import { attachBoardTabsEvents } from "./events.js";
import { selectBoardTabsVM } from "./selectors.js";
import { boardTabsTemplate } from "./template.js";

export const mountBoardTabsBlock = ({ root, store, actions }) => {
    let filterMenuOpen = false;
    let hasBoundEvents = false;
    let hasBoundDocumentEvents = false;

    const renderBlock = () => {
        root.innerHTML = boardTabsTemplate(selectBoardTabsVM(store.getState(), { filterMenuOpen }));
    };

    const closeFilterMenu = () => {
        if (!filterMenuOpen) {
            return;
        }
        filterMenuOpen = false;
        renderBlock();
    };

    const toggleFilterMenu = () => {
        filterMenuOpen = !filterMenuOpen;
        renderBlock();
    };

    return {
        render() {
            renderBlock();

            if (!hasBoundEvents) {
                attachBoardTabsEvents({
                    root,
                    actions,
                    toggleFilterMenu,
                    closeFilterMenu
                });
                hasBoundEvents = true;
            }

            if (!hasBoundDocumentEvents) {
                document.addEventListener("click", (event) => {
                    if (!filterMenuOpen) {
                        return;
                    }

                    if (event.target?.closest?.("[data-board-tabs-action='toggle-filters']")) {
                        return;
                    }

                    if (root.contains(event.target)) {
                        return;
                    }

                    closeFilterMenu();
                });
                hasBoundDocumentEvents = true;
            }
        }
    };
};
