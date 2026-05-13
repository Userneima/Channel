import { consumeFlashToast, getAppRoute } from "./shared/lib/route.js";
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

const createStandardRuntime = async () => {
    const [{ channelDataService }, { createStore }, { createAppActions }] = await Promise.all([
        import("./shared/data/channel-data-service.js"),
        import("./shared/state/store.js"),
        import("./features/app-actions.js")
    ]);

    const store = createStore();
    const actions = createAppActions({
        store,
        dataService: channelDataService
    });
    actions.initializeThemeMode(initialThemeMode);
    return { store, actions };
};

const createDemoRuntime = async () => {
    const [{ createDemoDataService }, { createStore }, { createAppActions }] = await Promise.all([
        import("./demo/data-service.js"),
        import("./shared/state/store.js"),
        import("./features/app-actions.js")
    ]);

    const store = createStore();
    const actions = createAppActions({
        store,
        dataService: createDemoDataService()
    });
    actions.initializeThemeMode(initialThemeMode);
    return { store, actions };
};

const bootstrap = async () => {
    if (view === "create-channel") {
        const [{ mountCreateChannelPage }, { store, actions }] = await Promise.all([
            import("./screens/create-channel/index.js"),
            createStandardRuntime()
        ]);

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
        return;
    }

    if (view === "demo") {
        const [{ mountDemoPage }, { store, actions }] = await Promise.all([
            import("./screens/demo-page/index.js"),
            createDemoRuntime()
        ]);

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
        return;
    }

    if (activeChannelSlug) {
        const [{ mountChannelPage }, { store, actions }] = await Promise.all([
            import("./screens/channel-page/index.js"),
            createStandardRuntime()
        ]);

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
        return;
    }

    const [{ mountChannelListPage }, { channelDataService }] = await Promise.all([
        import("./screens/channel-list/index.js"),
        import("./shared/data/channel-data-service.js")
    ]);

    void mountChannelListPage({
        root: appRoot,
        dataService: channelDataService
    });
};

void bootstrap();
