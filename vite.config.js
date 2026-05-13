import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
    root: "apps/channel-web",
    envDir: path.resolve(process.cwd()),
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes("/apps/channel-web/")) {
                        if (id.includes("/node_modules/@supabase/") || id.includes("/node_modules/ws/")) {
                            return "supabase";
                        }
                        return undefined;
                    }

                    if (id.includes("/apps/channel-web/src/demo/")) {
                        return "demo";
                    }

                    if (
                        id.includes("/blocks/comment-drawer/") ||
                        id.includes("/blocks/image-lightbox/") ||
                        id.includes("/blocks/notification-center/") ||
                        id.includes("/blocks/member-list-dialog/") ||
                        id.includes("/blocks/channel-menu-dialog/") ||
                        id.includes("/blocks/channel-settings-dialog/") ||
                        id.includes("/blocks/identity-dialog/") ||
                        id.includes("/blocks/auth-gate/") ||
                        id.includes("/blocks/search-dialog/") ||
                        id.includes("/blocks/registered-users-dialog/") ||
                        id.includes("/blocks/system-feedback/")
                    ) {
                        return "overlays";
                    }

                    if (
                        id.includes("/features/round/") ||
                        id.includes("/shared/data/channel-round-repository.js") ||
                        id.includes("/shared/data/channel-data-service/round.js")
                    ) {
                        return "round";
                    }

                    return undefined;
                }
            }
        }
    },
    test: {
        exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/.{idea,git,cache,output,temp}/**",
            "**/e2e/**"
        ]
    }
});
