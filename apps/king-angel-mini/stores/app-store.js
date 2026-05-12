const createStore = () => {
    let state = {
        session: null,
        currentUser: null,
        launchInviteCode: "",
        games: [],
        currentGame: null,
        currentTask: null,
        loading: false,
        error: ""
    };
    const listeners = new Set();

    const getState = () => state;

    const setState = (patch) => {
        state = {
            ...state,
            ...(patch || {})
        };
        listeners.forEach((listener) => listener(state));
    };

    const subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    return {
        getState,
        setState,
        subscribe
    };
};

module.exports = {
    createStore
};
