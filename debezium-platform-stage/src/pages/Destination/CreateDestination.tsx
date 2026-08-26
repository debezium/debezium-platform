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
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { fetchData } from "../../apis/apis";
import { ConnectorSchema } from "../../apis/types";
import CreateSchemaForm, {
  CreateSchemaFormHandle,
} from "@components/CreateSchemaForm";
import { PageHeader } from "@patternfly/react-component-groups";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { detectAndParseFormat } from "../../utils/formatCodeUtils";
import { useData } from "@appContext/AppContext";
import style from "../../styles/createConnector.module.css";

interface CreateDestinationProps {
  modelLoaded?: boolean;
  selectedId?: string;
  selectDestination?: (destinationId: string) => void;
  onSelection?: (selection: Destination) => void;
}

const CreateDestination: React.FunctionComponent<CreateDestinationProps> = ({
  modelLoaded = false,
  selectedId = "",
  selectDestination,
  onSelection,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { addNotification } = useNotification();
  const { darkMode } = useData();

  const destinationIdParam = useParams<{ destinationId: string }>();
  const destinationId = modelLoaded ? selectedId : destinationIdParam.destinationId;

  const descriptor = (location.state as { descriptor?: string } | null)?.descriptor;

  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<CreateSchemaFormHandle>(null);

  const editorSelected = destinationId ? "form-editor" : "smart-editor";
  const [codeText, setCodeText] = useState<string>("");

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

  const { data: destinations = [] } = useQuery<Destination[], Error>(
    "destinations",
    () => fetchData<Destination[]>(`${API_URL}/api/destinations`)
  );

  const existingDestinations = React.useMemo(() => {
    return Array.isArray(destinations) ? destinations.map((d) => d.name) : [];
  }, [destinations]);

  const handleCodeChange = (value: string) => {
    setCodeText(value);
  };

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
        `Failed to create ${(payload as { name: string }).name}: ${response.error}`
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

  const handleSubmitCode = () => {
    try {
      const finalPayload = detectAndParseFormat(codeText, "destination");

      if (!finalPayload || !finalPayload.name?.trim()) {
        addNotification("danger", "Validation failed", "Connector name is required.");
        return;
      }
      if (!finalPayload.type?.trim()) {
        addNotification("danger", "Validation failed", "Connector type is required.");
        return;
      }

      // Verify uniqueness of name
      if (existingDestinations.includes(finalPayload.name.trim())) {
        addNotification(
          "danger",
          "Validation failed",
          `Destination with name '${finalPayload.name.trim()}' already exists.`
        );
        return;
      }

      createNewDestination(finalPayload);
    } catch (e: unknown) {
      addNotification(
        "danger",
        "Validation failed",
        `Invalid configuration: ${(e as Error).message || "Invalid syntax"}`
      );
    }
  };

  const renderContent = () => {
    if (editorSelected === "form-editor") {
      if (!destinationId) {
        return (
          <Alert variant="warning" isInline title={t("common:emptyState.title", { val: t("destination:destination") })}>
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
          existingNames={existingDestinations}
          {...(modelLoaded ? { defaultLayoutMode: "tabs" as const } : {})}
        />
      );
    } else {
      return (
        <div className={`${style.smartEditor} smartEditor`}>
          <CodeEditor
            isUploadEnabled
            isDownloadEnabled
            isCopyEnabled
            isLanguageLabelVisible
            isMinimapVisible
            isDarkTheme={darkMode}
            language={codeText.trim().startsWith("{") || codeText.trim().startsWith("[") ? Language.json : Language.plaintext}
            downloadFileName="destination-config"
            isFullHeight
            code={codeText}
            onCodeChange={handleCodeChange}
          />
        </div>
      );
    }
  };

  return (
    <>
      {!modelLoaded && (
        <PageHeader
          title={t("destination:create.title")}
          subtitle={t("destination:create.description")}
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
                isDisabled={isLoading || (editorSelected === "form-editor" && (isSchemaLoading || !!schemaError))}
                type={ButtonType.submit}
                onClick={(e) => {
                  e.preventDefault();
                  if (editorSelected === "form-editor") {
                    formRef.current?.submit();
                  } else {
                    handleSubmitCode();
                  }
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
