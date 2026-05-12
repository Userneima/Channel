Component({
    properties: {
        task: {
            type: Object,
            value: {}
        },
        buttonText: {
            type: String,
            value: "去完成"
        }
    },
    methods: {
        onTap() {
            this.triggerEvent("action");
        }
    }
});
