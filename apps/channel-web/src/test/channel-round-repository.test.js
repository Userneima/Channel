import { describe, expect, it, vi } from "vitest";
import { createChannelRoundRepository } from "../shared/data/channel-round-repository.js";

describe("channel round repository", () => {
    it("preserves the current god profile when updating only the theme from normalized channel state", async () => {
        const rpc = vi.fn().mockResolvedValue({
            error: null
        });
        const from = vi.fn((table) => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                        data: table === "channels"
                            ? {
                                id: "channel-1",
                                slug: "channel",
                                name: "频道",
                                current_round_theme: "新主题",
                                current_round_god_name: "章鱼烧",
                                current_round_god_avatar: "octopus-avatar",
                                current_round_stage: "wish",
                                current_round_status: "active",
                                current_round_deadlines: {},
                                current_reveal_map: {}
                            }
                            : null,
                        error: null
                    })
                }))
            }))
        }));
        const repository = createChannelRoundRepository({
            getSupabaseClient: () => ({
                rpc,
                from
            }),
            ensureLoadedChannel: () => ({
                id: "channel-1",
                slug: "channel",
                name: "频道",
                currentRoundTheme: "旧主题",
                currentRoundGodProfile: {
                    userId: "user-god",
                    name: "章鱼烧",
                    avatar: "octopus-avatar"
                },
                currentRoundStage: "wish",
                currentRoundStatus: "active",
                currentRoundDeadlines: {},
                currentRevealMap: {}
            }),
            fetchPosts: vi.fn(),
            isSchemaCompatibilityError: vi.fn(() => false),
            normalizeClaimSelection: vi.fn(),
            syncChannelCaches: vi.fn(async (channel) => channel),
            normalizeChannel: vi.fn((channel) => channel),
            channelSelectFields: "id",
            identitySelectFields: "id",
            legacyIdentitySelectFields: "id",
            defaultChannelLogo: "",
            defaultChannelBackground: ""
        });

        await repository.updateChannelRoundState({
            theme: "新主题"
        });

        expect(rpc).toHaveBeenCalledWith("update_channel_current_round_state", expect.objectContaining({
            target_channel_id: "channel-1",
            next_theme: "新主题",
            next_god_profile: {
                userId: "user-god",
                name: "章鱼烧",
                avatar: "octopus-avatar"
            }
        }));
    });
});
