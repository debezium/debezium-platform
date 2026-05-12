import { forwardRef, useImperativeHandle, useRef } from "react";
import { ConnectorSchema } from "../apis/types";
import { Destination } from "../apis/apis";
import CreateSchemaForm, { CreateSchemaFormHandle } from "./CreateSchemaForm";

export interface CreateDestinationSchemaFormHandle {
  submit: () => void;
  validate: () => boolean;
  getLastValidationFailureBody: () => string | undefined;
}

interface CreateDestinationSchemaFormProps {
  connectorSchema: ConnectorSchema;
  destinationId: string;
  dataType?: string;
  initialDestination?: Destination;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  defaultLayoutMode?: "tabs" | "jumplinks";
}

/**
 * CreateDestinationSchemaForm - Adapter component for destination connectors
 *
 * This component adapts the CreateSchemaForm for use with destination connectors.
 * It maintains the same interface and behavior but is specifically designed for
 * destination connector schemas fetched from the catalog API.
 *
 * The underlying CreateSchemaForm is generic enough to handle both source and
 * destination connectors, as they share the same schema structure from the catalog API.
 */
const CreateDestinationSchemaForm = forwardRef<
  CreateDestinationSchemaFormHandle,
  CreateDestinationSchemaFormProps
>(({ connectorSchema, destinationId, dataType, initialDestination, onSubmit, defaultLayoutMode }, ref) => {
  const sourceFormRef = useRef<CreateSchemaFormHandle>(null);

  useImperativeHandle(ref, () => ({
    submit: () => {
      sourceFormRef.current?.submit();
    },
    validate: () => {
      return sourceFormRef.current?.validate() ?? false;
    },
    getLastValidationFailureBody: () => {
      return sourceFormRef.current?.getLastValidationFailureBody();
    },
  }));

  // Convert destination to source format for the form
  const initialSource = initialDestination ? {
    ...initialDestination,
    // Ensure all required fields are present
    id: initialDestination.id,
    name: initialDestination.name,
    type: initialDestination.type,
    description: initialDestination.description,
    config: initialDestination.config,
    connection: initialDestination.connection,
    vaults: initialDestination.vaults,
    schema: initialDestination.schema,
  } : undefined;

  return (
    <CreateSchemaForm
      ref={sourceFormRef}
      connectorSchema={connectorSchema}
      sourceId={destinationId}
      dataType={dataType}
      initialSource={initialSource as any}
      onSubmit={onSubmit}
      defaultLayoutMode={defaultLayoutMode}
      hideSignalCollections={true}
    />
  );
});

CreateDestinationSchemaForm.displayName = "CreateDestinationSchemaForm";

export default CreateDestinationSchemaForm;

// Made with Bob
