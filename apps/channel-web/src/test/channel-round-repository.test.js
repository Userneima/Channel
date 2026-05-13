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

    it("filters out removed users from current round member statuses", async () => {
        const from = vi.fn((table) => {
            if (table === "channel_round_members") {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            order: vi.fn().mockResolvedValue({
                                data: [
                                    {
                                        identity_id: "identity-1",
                                        user_id: "user-1",
                                        display_name_snapshot: "Yuchao",
                                        avatar_snapshot: "avatar-1",
                                        role_snapshot: "owner",
                                        claim_post_id: null,
                                        claim_selected_at: null,
                                        guess_target_name_snapshot: "",
                                        guess_target_avatar_snapshot: "",
                                        guess_selected_at: null
                                    },
                                    {
                                        identity_id: "identity-deleted",
                                        user_id: "user-deleted",
                                        display_name_snapshot: "测试 1",
                                        avatar_snapshot: "avatar-2",
                                        role_snapshot: "member",
                                        claim_post_id: null,
                                        claim_selected_at: null,
                                        guess_target_name_snapshot: "",
                                        guess_target_avatar_snapshot: "",
                                        guess_selected_at: null
                                    }
                                ],
                                error: null
                            })
                        }))
                    }))
                };
            }

            if (table === "identities") {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => Promise.resolve({
                            data: [
                                { id: "identity-1", user_id: "user-1" }
                            ],
                            error: null
                        }))
                    }))
                };
            }

            if (table === "channel_rounds") {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: vi.fn().mockResolvedValue({
                                data: {
                                    reveal_map: {}
                                },
                                error: null
                            })
                        }))
                    }))
                };
            }

            throw new Error(`Unexpected table ${table}`);
        });

        const repository = createChannelRoundRepository({
            getSupabaseClient: () => ({
                from
            }),
            ensureLoadedChannel: () => ({
                id: "channel-1",
                slug: "channel",
                currentRoundId: "round-1"
            }),
            fetchPosts: vi.fn(),
            fetchRoundPosts: vi.fn(async () => []),
            isSchemaCompatibilityError: vi.fn(() => false),
            normalizeClaimSelection: vi.fn(),
            syncChannelCaches: vi.fn(async (channel) => channel),
            normalizeChannel: vi.fn((channel) => channel),
            channelSelectFields: "id",
            identitySelectFields: "id",
            legacyIdentitySelectFields: "id",
            roundSelectFields: "reveal_map",
            roundMemberSelectFields: "identity_id,user_id,display_name_snapshot,avatar_snapshot,role_snapshot",
            defaultChannelLogo: "",
            defaultChannelBackground: ""
        });

        const items = await repository.listRoundMemberStatuses();

        expect(items).toHaveLength(1);
        expect(items[0].name).toBe("Yuchao");
    });

    it("counts proxy-recorded wishes under the actual participant", async () => {
        const from = vi.fn((table) => {
            if (table === "channel_round_members") {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            order: vi.fn().mockResolvedValue({
                                data: [{
                                    identity_id: "identity-2",
                                    user_id: "user-2",
                                    display_name_snapshot: "海屿",
                                    avatar_snapshot: "haiyu-avatar",
                                    role_snapshot: "member",
                                    claim_post_id: null,
                                    claim_selected_at: null,
                                    guess_target_name_snapshot: "",
                                    guess_target_avatar_snapshot: "",
                                    guess_selected_at: null
                                }],
                                error: null
                            })
                        }))
                    }))
                };
            }

            if (table === "identities") {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => Promise.resolve({
                            data: [
                                { id: "identity-2", user_id: "user-2" }
                            ],
                            error: null
                        }))
                    }))
                };
            }

            if (table === "channel_rounds") {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            maybeSingle: vi.fn().mockResolvedValue({
                                data: {
                                    reveal_map: {}
                                },
                                error: null
                            })
                        }))
                    }))
                };
            }

            throw new Error(`Unexpected table ${table}`);
        });

        const repository = createChannelRoundRepository({
            getSupabaseClient: () => ({
                from
            }),
            ensureLoadedChannel: () => ({
                id: "channel-1",
                slug: "channel",
                currentRoundId: "round-1"
            }),
            fetchPosts: vi.fn(),
            fetchRoundPosts: vi.fn(async (roundId, board) => board === "wish"
                ? [{
                    id: "wish-1",
                    board: "wish",
                    authorUserId: "user-god",
                    authorName: "白榆",
                    authorAvatar: "alias-avatar",
                    createdAt: "2026-05-13T12:00:00.000Z",
                    isDeleted: false,
                    text: "代录的愿望",
                    wishMeta: {
                        participantUserId: "user-2",
                        participantName: "海屿",
                        participantAvatar: "haiyu-avatar",
                        submissionSource: "proxy",
                        recordedByName: "章鱼烧"
                    }
                }]
                : []),
            isSchemaCompatibilityError: vi.fn(() => false),
            normalizeClaimSelection: vi.fn(),
            syncChannelCaches: vi.fn(async (channel) => channel),
            normalizeChannel: vi.fn((channel) => channel),
            channelSelectFields: "id",
            identitySelectFields: "id",
            legacyIdentitySelectFields: "id",
            roundSelectFields: "reveal_map",
            roundMemberSelectFields: "identity_id,user_id,display_name_snapshot,avatar_snapshot,role_snapshot",
            defaultChannelLogo: "",
            defaultChannelBackground: ""
        });

        const items = await repository.listRoundMemberStatuses();

        expect(items[0].wishSubmitted).toBe(true);
        expect(items[0].participatingInRound).toBe(true);
        expect(items[0].wishSubmissionSource).toBe("proxy");
        expect(items[0].wishRecordedByName).toBe("章鱼烧");
    });
});
