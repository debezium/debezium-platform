import { initialConnectorSchema, kafkaConnectSchema } from "@utils/schemas";
import Ajv from "ajv";
import { useMemo } from "react";

const ajv = new Ajv();

export function useFormatDetector(code: unknown, connectorType: "source" | "destination") {
    const validate = ajv.compile(initialConnectorSchema);
    const validateKafkaSchema = ajv.compile(kafkaConnectSchema);

    // Compute format type based on code and connectorType
    const codeFormatType = useMemo(() => {
        if (!code) return "";

        if (isValidJson(code)) {
            if (connectorType === "source") {
                const isKafkaConnectSchema = validateKafkaSchema(code);
                if (isKafkaConnectSchema) {
                    return "kafka-connect";
                }
            }
            const isValid = validate(code);
            if (isValid) {
                return "dbz-platform";
            }
            return "";
        } else if (typeof code === "string" && code.includes("debezium.source.")) {
            return "properties-file";
        } else {
            console.log("Invalid JSON format");
            return "";
        }
    }, [code, connectorType, validate, validateKafkaSchema]);

    const formatDetection = {
        formatType: codeFormatType,
        isValidFormat: validate(code),
        errorMsg: ajv.errorsText(validate.errors),
    };
    return formatDetection;
}

export function isValidJson(value: string | object): boolean {
    // It's a string — try to parse it and check if it's a plain object
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
        } catch {
            return false;
        }
    }

    // It's already an object — check if it's plain and JSON-serializable
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        try {
            JSON.stringify(value); // Will throw if circular or un-serializable
            return true;
        } catch {
            return false;
        }
    }

    return false;
}
