Page({
    data: {
        session: null
    },

    onShow() {
        this.setData({ session: getApp().store.getState().session });
    }
});
