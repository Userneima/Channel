const { ROLE_LABELS } = require("../../services/game-rules");

Component({
    properties: {
        member: {
            type: Object,
            value: {}
        }
    },
    data: {
        roleLabel: "成员"
    },
    observers: {
        member(member) {
            this.setData({
                roleLabel: ROLE_LABELS[member?.role] || "成员"
            });
        }
    }
});
