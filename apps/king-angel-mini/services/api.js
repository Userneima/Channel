const { API_BASE_URL } = require("./config");
const session = require("./session");

const buildHeader = (options = {}) => {
    const currentSession = session.getSession();
    return {
        "content-type": "application/json",
        ...(options.skipAuth || !currentSession?.token
            ? {}
            : { Authorization: `Bearer ${currentSession.token}` })
    };
};

const request = (action, payload = {}, options = {}) => new Promise((resolve, reject) => {
    if (!API_BASE_URL || API_BASE_URL.includes("<project-ref>")) {
        reject({
            code: "missing_api_base_url",
            message: "请先在 services/config.js 配置小程序 API 地址。"
        });
        return;
    }

    wx.request({
        url: API_BASE_URL,
        method: "POST",
        header: buildHeader(options),
        data: {
            action,
            payload
        },
        success(response) {
            const body = response.data || {};
            if (response.statusCode >= 200 && response.statusCode < 300 && body.ok) {
                resolve(body.data);
                return;
            }
            if (response.statusCode === 401) {
                session.clearSession();
            }
            reject(body.error || {
                code: "network_error",
                message: "请求失败，请稍后再试。"
            });
        },
        fail(error) {
            reject({
                code: "network_error",
                message: error?.errMsg || "网络不可用。"
            });
        }
    });
});

module.exports = {
    request
};
