const THEME_STORAGE_KEY = "channel-web-theme-mode";

export const normalizeThemeMode = (value) => (
    value === "dark"
        ? "dark"
        : "light"
);

export const applyDocumentTheme = (value) => {
    if (typeof document === "undefined") {
        return "light";
    }

    const themeMode = normalizeThemeMode(value);
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.colorScheme = themeMode;
    return themeMode;
};

export const readStoredThemeMode = () => {
    if (typeof window === "undefined") {
        return "light";
    }

    try {
        return normalizeThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
        return "light";
    }
};

export const writeStoredThemeMode = (value) => {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, normalizeThemeMode(value));
    } catch {
        // Ignore storage failures in private or restricted modes.
    }
};
