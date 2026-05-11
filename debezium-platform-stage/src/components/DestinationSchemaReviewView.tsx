import React from "react";
import { ConnectorSchema } from "../apis/types";
import { Destination } from "../apis/apis";
import SourceSchemaReviewView from "./SourceSchemaReviewView";

interface DestinationSchemaReviewViewProps {
  destination: Destination;
  connectorSchema: ConnectorSchema;
  dataType: string;
}

/**
 * DestinationSchemaReviewView - Adapter component for destination connector review
 * 
 * This component adapts the SourceSchemaReviewView for use with destination connectors.
 * It maintains the same interface and behavior but is specifically designed for
 * destination connector schemas fetched from the catalog API.
 * 
 * The underlying SourceSchemaReviewView is generic enough to handle both source and
 * destination connectors, as they share the same schema structure from the catalog API.
 */
const DestinationSchemaReviewView: React.FC<DestinationSchemaReviewViewProps> = ({
  destination,
  connectorSchema,
  dataType,
}) => {
  // Convert destination to source format for the review view
  const source = {
    ...destination,
    // Ensure all required fields are present
    id: destination.id,
    name: destination.name,
    type: destination.type,
    description: destination.description,
    config: destination.config,
    connection: destination.connection,
    vaults: destination.vaults,
    schema: destination.schema,
  };

  return (
    <SourceSchemaReviewView
      source={source as any}
      connectorSchema={connectorSchema}
      dataType={dataType}
    />
  );
};

export default DestinationSchemaReviewView;

// Made with Bob
