import { initialConnectorSchema, kafkaConnectSchema } from "@utils/schemas";
import Ajv from "ajv";
import { useEffect, useState } from "react";


const ajv = new Ajv();

export function useFormatDetector(code: any) {

    const [codeFormatType, setFormatType] = useState<string>("");
    const validate = ajv.compile(initialConnectorSchema);
    const validateKafkaSchema = ajv.compile(kafkaConnectSchema);

    useEffect(() => {
        if (!!code) {
            if (isValidJson(code)) {
                const isKafkaConnectSchema = validateKafkaSchema(code);
                const isValid = validate(code);
                if (isKafkaConnectSchema) {
                    setFormatType("kafka-connect");
                    return;
                }
                else if (isValid) {
                    setFormatType("dbz-platform");
                }
            } else {
                setFormatType("properties-file");
            }
        }
    }, [code]);

    const formatDetection = {
        formatType: codeFormatType,
        isValidFormat: validate(code),
        errorMsg: ajv.errorsText(validate.errors)
    };
    return formatDetection;
}

export function isValidJson(value: any): boolean {
    // It's a string — try to parse it and check if it's a plain object
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
        } catch {
            return false;
        }
    }

    // It's already an object — check if it's plain and JSON-serializable
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        try {
            JSON.stringify(value); // Will throw if circular or un-serializable
            return true;
        } catch {
            return false;
        }
    }

    return false;
}
