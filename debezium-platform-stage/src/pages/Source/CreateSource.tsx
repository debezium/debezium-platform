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
import { createPost, Payload, Source } from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { useNotification } from "../../appLayout/AppNotificationContext";
import PageHeader from "@components/PageHeader";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { fetchData } from "../../apis/apis";
import { ConnectorSchema } from "../../apis/types";
import CreateSourceSchemaForm, {
  CreateSourceSchemaFormHandle,
} from "@components/CreateSourceSchemaForm";

interface CreateSourceProps {
  modelLoaded?: boolean;
  selectedId?: string;
  selectSource?: (sourceId: string) => void;
  onSelection?: (selection: Source) => void;
}

export type SelectedDataListItem = {
  schemas: string[];
  tables: string[];
};

const CreateSource: React.FunctionComponent<CreateSourceProps> = ({
  modelLoaded,
  selectedId,
  selectSource,
  onSelection,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { addNotification } = useNotification();

  const sourceIdParam = useParams<{ sourceId: string }>();
  const sourceId = modelLoaded ? selectedId : sourceIdParam.sourceId;

  const descriptor = (location.state as { descriptor?: string } | null)?.descriptor;

  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<CreateSourceSchemaFormHandle>(null);

  const descriptorPath = React.useMemo(() => {
    if (descriptor) return descriptor.replace(/\.json$/, "");
    if (sourceId) return `source-connector/${sourceId}`;
    return null;
  }, [descriptor, sourceId]);

  const {
    data: connectorSchema,
    isLoading: isSchemaLoading,
    error: schemaError,
  } = useQuery<ConnectorSchema, Error>(
    ["connectorSchema", descriptorPath],
    () => fetchData<ConnectorSchema>(`${API_URL}/api/catalog/${descriptorPath}`),
    { enabled: !!descriptorPath }
  );

  const createNewSource = async (payload: Record<string, unknown>) => {
    console.log("payload", payload);
    // return;
    setIsLoading(true);
    const response = await createPost(
      `${API_URL}/api/sources`,
      payload as unknown as Payload
    );
    if (response.error) {
      addNotification(
        "danger",
        "Source creation failed",
        `Failed to create ${(response.data as Source)?.name}: ${response.error}`
      );
    } else {
      if (modelLoaded) onSelection?.(response.data as Source);
      addNotification(
        "success",
        "Create successful",
        `Source "${(response.data as Source).name}" created successfully.`
      );
      if (!modelLoaded) navigate("/source");
    }
    setIsLoading(false);
  };

  const renderContent = () => {
    if (!sourceId) {
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
      <CreateSourceSchemaForm
        ref={formRef}
        connectorSchema={connectorSchema}
        sourceId={sourceId}
        onSubmit={createNewSource}
      />
    );
  };

  return (
    <>
      {!modelLoaded && (
        <PageHeader
          title={t("source:create.title")}
          description={t("source:create.description")}
        />
      )}

      <PageSection isFilled>
        {renderContent()}
      </PageSection>

      <PageSection className="pf-m-sticky-bottom" isFilled={false}>
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
                {t("source:create.title")}
              </Button>
            </ActionListItem>
            <ActionListItem>
              {modelLoaded ? (
                <Button
                  variant="link"
                  onClick={() => selectSource && selectSource("")}
                >
                  {t("back")}
                </Button>
              ) : (
                <Button
                  variant="link"
                  onClick={() => navigate("/source/catalog")}
                >
                  {t("source:catalog.backToCatalog")}
                </Button>
              )}
            </ActionListItem>
          </ActionListGroup>
        </ActionList>
      </PageSection>
    </>
  );
};

export { CreateSource };
