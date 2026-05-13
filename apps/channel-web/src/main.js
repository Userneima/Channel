import { channelDataService } from "./shared/data/channel-data-service.js";
import { createStore } from "./shared/state/store.js";
import { createAppActions } from "./features/app-actions.js";
import { consumeFlashToast, getAppRoute } from "./shared/lib/route.js";
import { mountCreateChannelPage } from "./screens/create-channel/index.js";
import { mountChannelPage } from "./screens/channel-page/index.js";
import { mountChannelListPage } from "./screens/channel-list/index.js";
import { mountDemoPage } from "./screens/demo-page/index.js";
import { createDemoDataService } from "./demo/data-service.js";
import { applyDocumentTheme, readStoredThemeMode } from "./shared/lib/theme.js";
import "./shared/styles/tokens.css";
import "./shared/styles/foundations.css";
import "./shared/styles/app.css";

const appRoot = document.getElementById("app");
const initialThemeMode = readStoredThemeMode();

applyDocumentTheme(initialThemeMode);

if (!appRoot) {
    throw new Error("Missing #app root.");
}

const { channelSlug: activeChannelSlug, view } = getAppRoute();

if (view === "create-channel") {
    const store = createStore();
    const actions = createAppActions({
        store,
        dataService: channelDataService
    });
    actions.initializeThemeMode(initialThemeMode);

    mountCreateChannelPage({
        root: appRoot,
        store,
        actions
    });

    const flashToast = consumeFlashToast();
    if (flashToast) {
        actions.showToast(flashToast);
    }
    void actions.initializeCreateChannelPage();
} else if (view === "demo") {
    const store = createStore();
    const actions = createAppActions({
        store,
        dataService: createDemoDataService()
    });
    actions.initializeThemeMode(initialThemeMode);

    store.dispatch({
        type: "feed/set-board",
        payload: { board: "wish" }
    });
    store.dispatch({
        type: "round/set-stage",
        payload: {
            stage: "wish",
            forceAnonymous: true
        }
    });

    mountDemoPage({
        root: appRoot,
        store,
        actions
    });

    void actions.initializeChannelRuntime();
} else if (activeChannelSlug) {
    const store = createStore();
    const actions = createAppActions({
        store,
        dataService: channelDataService
    });
    actions.initializeThemeMode(initialThemeMode);

    mountChannelPage({
        root: appRoot,
        store,
        actions
    });

    const flashToast = consumeFlashToast();
    if (flashToast) {
        actions.showToast(flashToast);
    }
    void actions.initializeChannelRuntime();
} else {
    void mountChannelListPage({
        root: appRoot,
        dataService: channelDataService
    });
}
