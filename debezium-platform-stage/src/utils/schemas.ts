// Connector schema
export const connectorSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        description: { type: "string" },
        type: { type: "string" },
        schema: { type: "string" },
        vault: { type: "array" },
        config: {
            type: "object",
            minProperties: 1,
        },
    },
    required: ["name", "type", "schema", "config"],
};

export const initialConnectorSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        description: { type: "string" },
        type: { type: "string" },
        schema: { type: "string" },
        vault: { type: "array" },
        config: {
            type: "object",
            // minProperties: 1,
        },
    },
    required: ["name", "type", "schema", "config"],
};

export const transformSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        description: { type: "string" },
        type: { type: "string" },
        schema: { type: "string" },
        vault: { type: "array" },
        config: {
            type: "object",
            minProperties: 1,
        },
        predicate: {
            type: "object",
            properties: {
                type: { type: "string" },
                config: {
                    type: "object",
                },
                negate: { type: "boolean" },
            },
        }
    },
    required: ["name", "type", "schema", "config"],
};

export const pipelineSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        description: { type: "string" },
        source: {
            type: "object",
            properties: { name: { type: "string" }, id: { type: "number" } },
            required: ["name", "id"],
        },
        destination: {
            type: "object",
            properties: { name: { type: "string" }, id: { type: "number" } },
            required: ["name", "id"],
        },
        transforms: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    id: { type: "number" },
                },
                required: ["name", "id"],
            },
        },
    },
    required: ["name", "source", "destination"],
};

export const DebeziumConnectorClassEnum = [
    "io.debezium.connector.mysql.MySqlConnector",
    "io.debezium.connector.mongodb.MongoDbConnector",
    "io.debezium.connector.postgresql.PostgresConnector",
    "io.debezium.connector.sqlserver.SqlServerConnector",
    "io.debezium.connector.oracle.OracleConnector",
    "io.debezium.connector.mariadb.MariaDbConnector"
] as const;

export const kafkaConnectSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        config: {
            type: "object",
            properties: {
                "connector.class": {
                    type: "string",
                    enum: DebeziumConnectorClassEnum
                }
            },
            required: ["connector.class"],
            additionalProperties: true
        }
    },
    required: ["name", "config"],
    additionalProperties: false
};