const { STAGES } = require("../../services/game-rules");

Component({
    properties: {
        currentStage: {
            type: String,
            value: "wish"
        }
    },
    data: {
        stages: STAGES
    },
    observers: {
        currentStage() {
            this.setData({ stages: STAGES });
        }
    }
});
