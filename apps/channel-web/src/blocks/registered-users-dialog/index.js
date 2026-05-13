import "./styles.css";
import { attachRegisteredUsersDialogEvents } from "./events.js";
import { selectRegisteredUsersDialogVM } from "./selectors.js";
import { registeredUsersDialogTemplate } from "./template.js";

export const mountRegisteredUsersDialogBlock = ({ root, store, actions }) => {
    let hasBoundEvents = false;

    return {
        render() {
            root.innerHTML = registeredUsersDialogTemplate(selectRegisteredUsersDialogVM(store.getState()));
            if (!hasBoundEvents) {
                attachRegisteredUsersDialogEvents({ root, actions });
                hasBoundEvents = true;
            }
        }
    };
};
