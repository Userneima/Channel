const SESSION_KEY = "king_angel_session";

const getSession = () => {
    try {
        return wx.getStorageSync(SESSION_KEY) || null;
    } catch (error) {
        return null;
    }
};

const setSession = (session) => {
    wx.setStorageSync(SESSION_KEY, session || null);
};

const clearSession = () => {
    wx.removeStorageSync(SESSION_KEY);
};

module.exports = {
    getSession,
    setSession,
    clearSession
};
