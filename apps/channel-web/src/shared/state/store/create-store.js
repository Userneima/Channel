import { applyAction } from "./apply-action.js";
import { cloneState } from "./clone-state.js";
import { createInitialState } from "./initial-state.js";

export const createStore = (initialState = createInitialState()) => {
    let state = cloneState(initialState);
    const listeners = new Set();

    return {
        getState() {
            return state;
        },
        dispatch(action) {
            const nextState = cloneState(state);
            applyAction(nextState, action);
            state = nextState;
            listeners.forEach((listener) => {
                listener(state, action);
            });
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        }
    };
};
