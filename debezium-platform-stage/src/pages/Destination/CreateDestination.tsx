import * as React from "react";
import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Alert,
  Button,
  ButtonType,
  PageSection,
  Skeleton,
} from "@patternfly/react-core";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useRef, useState } from "react";
import { createPost, Payload, Destination } from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { useNotification } from "../../appLayout/AppNotificationContext";
import PageHeader from "@components/PageHeader";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { fetchData } from "../../apis/apis";
import { ConnectorSchema } from "../../apis/types";
import CreateSchemaForm, {
  CreateSchemaFormHandle,
} from "@components/CreateSchemaForm";

interface CreateDestinationProps {
  modelLoaded?: boolean;
  selectedId?: string;
  selectDestination?: (destinationId: string) => void;
  onSelection?: (selection: Destination) => void;
}

const CreateDestination: React.FunctionComponent<CreateDestinationProps> = ({
  modelLoaded,
  selectedId,
  selectDestination,
  onSelection,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { addNotification } = useNotification();

  const destinationIdParam = useParams<{ destinationId: string }>();
  const destinationId = modelLoaded ? selectedId : destinationIdParam.destinationId;

  const descriptor = (location.state as { descriptor?: string } | null)?.descriptor;

  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<CreateSchemaFormHandle>(null);

  const descriptorPath = React.useMemo(() => {
    if (descriptor) return descriptor.replace(/\.json$/, "");
    if (destinationId) return `server-sink/${destinationId}`;
    return null;
  }, [descriptor, destinationId]);

  const {
    data: connectorSchema,
    isLoading: isSchemaLoading,
    error: schemaError,
  } = useQuery<ConnectorSchema, Error>(
    ["connectorSchema", descriptorPath],
    () => fetchData<ConnectorSchema>(`${API_URL}/api/catalog/${descriptorPath}`),
    { enabled: !!descriptorPath }
  );

  const createNewDestination = async (payload: Record<string, unknown>) => {
    setIsLoading(true);
    const response = await createPost(
      `${API_URL}/api/destinations`,
      payload as unknown as Payload
    );
    if (response.error) {
      addNotification(
        "danger",
        "Destination creation failed",
        `Failed to create ${(response.data as Destination)?.name}: ${response.error}`
      );
    } else {
      if (modelLoaded) onSelection?.(response.data as Destination);
      addNotification(
        "success",
        "Create successful",
        `Destination "${(response.data as Destination).name}" created successfully.`
      );
      if (!modelLoaded) navigate("/destination");
    }
    setIsLoading(false);
  };

  const renderContent = () => {
    if (!destinationId) {
      return (
        <Alert variant="warning" isInline title="No connector selected">
          Please select a connector from the catalog first.
        </Alert>
      );
    }

    if (isSchemaLoading) {
      return (
        <div>
          <Skeleton fontSize="2xl" width="40%" />
          <br />
          <Skeleton fontSize="md" width="60%" />
          <br />
          <Skeleton fontSize="md" width="80%" />
          <br />
          <Skeleton fontSize="md" width="50%" />
        </div>
      );
    }

    if (schemaError) {
      return (
        <Alert variant="danger" isInline title="Failed to load connector schema">
          {schemaError.message}
        </Alert>
      );
    }

    if (!connectorSchema) return null;

    return (
      <CreateSchemaForm
        ref={formRef}
        connectorSchema={connectorSchema}
        destinationId={destinationId}
        onSubmit={createNewDestination}
        hideSignalCollections={true}
        {...(modelLoaded ? { defaultLayoutMode: "tabs" as const } : {})}
      />
    );
  };

  return (
    <>
      {!modelLoaded && (
        <PageHeader
          title={t("destination:create.title")}
          description={t("destination:create.description")}
        />
      )}

      <PageSection
        isFilled
        padding={modelLoaded ? { default: "noPadding" } : undefined}
      >
        {renderContent()}
      </PageSection>

      <PageSection
        className="pf-m-sticky-bottom"
        isFilled={false}
        padding={modelLoaded ? { default: "noPadding" } : undefined}
      >
        <ActionList>
          <ActionListGroup>
            <ActionListItem>
              <Button
                variant="primary"
                isLoading={isLoading}
                isDisabled={isLoading || isSchemaLoading || !!schemaError}
                type={ButtonType.submit}
                onClick={(e) => {
                  e.preventDefault();
                  formRef.current?.submit();
                }}
              >
                {t("destination:create.title")}
              </Button>
            </ActionListItem>
            <ActionListItem>
              {modelLoaded ? (
                <Button
                  variant="link"
                  onClick={() => selectDestination && selectDestination("")}
                >
                  {t("back")}
                </Button>
              ) : (
                <Button
                  variant="link"
                  onClick={() => navigate("/destination/catalog")}
                >
                  {t("destination:catalog.backToCatalog")}
                </Button>
              )}
            </ActionListItem>
          </ActionListGroup>
        </ActionList>
      </PageSection>
    </>
  );
};

export { CreateDestination };
