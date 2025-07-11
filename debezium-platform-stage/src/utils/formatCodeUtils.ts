import { Payload } from "src/apis";

export function formatCode(connectorType: "source" | "destination",formatType: string, code: string | object): Payload {
    const kafkaFormat = code as Payload;
    let formattedCode = {} as Payload;
    if (formatType === "kafka-connect") {
        formattedCode = {
            "name": kafkaFormat.name || "",
            "description": "",
            "type": kafkaFormat.config["connector.class"] || "",
            "schema": "schema123",
            "vaults": [],
            "config": Object.keys(kafkaFormat.config || {}).reduce((acc: Record<string, string>, key) => {
                if (key !== "connector.class") {
                    acc[key] = kafkaFormat.config[key];
                }
                return acc;
            }, {})
        };
    } else if (formatType === "properties-file") {
        const lines = (code as string).split(/\r?\n/);
        const config: Record<string, string> = {};
        let connectorClass = "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const match = trimmed.match(/^\s*([a-zA-Z0-9._-]+)\s*=\s*(.*)$/);
            if (match) {
                const key = match[1];
                const value = match[2];
                if(connectorType === "source"){
                    if (key === "debezium.source.connector.class") {
                        connectorClass = value;
                    } else if (key.startsWith("debezium.source.")) {
                        config[key] = value;
                    }
                }else {
                    if (key === "debezium.sink.type") {
                        connectorClass = value;
                    } else if (key.startsWith("debezium.sink.")) {
                        config[key] = value;
                    }
                }
               
            }
        }

        formattedCode = {
            name: "",
            description: "",
            type: connectorClass,
            schema: "schema123",
            vaults: [],
            config,
        };
    }
    return formattedCode;
}