const normalizeRegisteredUserItem = (row) => ({
    userId: row.user_id || row.userId || null,
    email: String(row.email || "").trim(),
    displayName: String(row.display_name || row.displayName || "").trim() || "未命名用户",
    avatarUrl: String(row.avatar_url || row.avatarUrl || "").trim(),
    createdAt: row.created_at || row.createdAt || null,
    lastSignInAt: row.last_sign_in_at || row.lastSignInAt || null
});

export const createAdminApi = (context) => ({
    async listRegisteredUsers() {
        const client = context.getSupabaseClient();
        const { data, error } = await client.rpc("list_registered_users");

        if (error) {
            throw error;
        }

        return Array.isArray(data) ? data.map(normalizeRegisteredUserItem) : [];
    }
});
