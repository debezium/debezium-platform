
import { find } from "lodash";
import { Payload, Predicate, TransformPayload } from "src/apis";

export function formatCode(connectorType: "source" | "destination", formatType: string, code: string | object): Payload {
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
                if (connectorType === "source") {
                    if (key === "debezium.source.connector.class") {
                        connectorClass = value;
                    } else if (key.startsWith("debezium.source.")) {
                        config[key] = value;
                    }
                } else {
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




export function extractTransformsAndPredicates(code: string | object): TransformPayload[] {
    const lines = typeof code === "string" ? code.split(/\r?\n/) : [];
    const parsedConfig: Record<string, string> = {};
    // Parse all configuration lines
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = trimmed.match(/^\s*([a-zA-Z0-9._-]+)\s*=\s*(.*)$/);
        if (match) {
            const key = match[1];
            const value = match[2].trim();
            if (key.includes("debezium.transforms") || key.includes("debezium.predicates")) {
                parsedConfig[key] = value;
            }
        }
    }
    const transforms: TransformPayload[] = [];
    const predicatesConfig: Record<string, Record<string, string>> = {};
    const predicatesList = parsedConfig["debezium.predicates"];
    const predicateNames = predicatesList ? predicatesList.split(",").map(name => name.trim()) : [];

    // Extract predicate properties
    Object.keys(parsedConfig).forEach(key => {
        const predicateMatch = key.match(/^debezium\.predicates\.([^.]+)\.(.+)$/);
        if (predicateMatch) {
            const predicateName = predicateMatch[1];
            const predicateProperty = predicateMatch[2];

            if (predicateNames.includes(predicateName)) {
                if (!predicatesConfig[predicateName]) {
                    predicatesConfig[predicateName] = {};
                }
                predicatesConfig[predicateName][predicateProperty] = parsedConfig[key];
            }
        }
    });

    const transformsList = parsedConfig["debezium.transforms"];
    if (transformsList) {
        const transformNames = transformsList ? transformsList.split(",").map(name => name.trim()) : [];
        transformNames.forEach(transformName => {
            transforms.push({
                name: transformName,
                type: "",
                schema: "schema123",
                vaults: [],
                config: {},
                description: `Transform: ${transformName}`
            });
        });

        Object.keys(parsedConfig).forEach(key => {
            const transformMatch = key.match(/^debezium\.transforms\.([^.]+)\.(.+)$/);
            if (transformMatch) {
                const transformName = transformMatch[1];
                const transformProperty = transformMatch[2];
                const transform = find(transforms, { name: transformName })
                if (transform) {
                    if (transformProperty === "type") {
                        transform.type = parsedConfig[key];
                    } else if (transformProperty === "predicate") {
                        transform.predicate = {
                            type: predicatesConfig[parsedConfig[key]]?.type || "",
                            config: Object.fromEntries(
                                Object.entries(predicatesConfig[parsedConfig[key]] || {}).filter(([prop]) => prop !== "type")
                            )
                        } as Predicate;
                    } else if (transformProperty === "negate") {
                        if (transform.predicate) {
                            transform.predicate = {
                                ...transform.predicate,
                                negate: parsedConfig[key] === "true"
                            } as Predicate;
                        } else {
                            transform.predicate = {
                                negate: parsedConfig[key] === "true"
                            } as Predicate;
                        }

                    } else {
                        transform.config[transformProperty] = parsedConfig[key];
                    }
                }
            }
        });


    }
    return transforms;


}
