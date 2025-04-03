export type ActionType = "execute-snapshot" | "log" | "stop-snapshot" | "pause-snapshot" | "resume-snapshot";
export type SnapshotType = "INCREMENTAL" | "BLOCKING";
export const pipelineAction = [
    {
        action: "adhocSnapshot",
        type: "execute-snapshot",
        data:{
            "data-collection": [""],
            type: "INCREMENTAL",
            "addition-collection" : [{
                "data-collection": "",
                filter: "",
            }]
        }
    },
    {
        action: "stopAdhocSnapshot",
        type: "stop-snapshot",
        data:{
            type: "INCREMENTAL",
            "data-collection": [""],
        }
    },
    {
        action: "adhocIncremental",
        type: "execute-snapshot",
        data:{
            "data-collection": [""],
            type: "INCREMENTAL",
            "addition-collection" : [{
                "data-collection": "",
                filter: "",
            }]
        }
    },

    {
        action: "pauseIncremental",
        type: "pause-snapshot",
    },
    {
        action: "resumeIncremental",
        type: "resume-snapshot",
    },
    {
        action: "adhocBlocking",
        type: "execute-snapshot",
        data: {
            "data-collection": [""],
            type: "BLOCKING",
            "addition-collection" : [{
                "data-collection": "",
                filter: "",
            }]
        }
    },
    {
        action: "log",
        type: "log",
        data: {
            message: "",
        }
    }
];