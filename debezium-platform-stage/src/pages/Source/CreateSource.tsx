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

interface CreateSourceProps {
  modelLoaded?: boolean;
  selectedId?: string;
  selectSource?: (sourceId: string) => void;
  onSelection?: (selection: Source) => void;
}

const CreateSource: React.FunctionComponent<CreateSourceProps> = ({
  modelLoaded = false,
  selectedId = "",
  selectSource,
  onSelection,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { addNotification } = useNotification();
  const { darkMode } = useData();

  const sourceIdParam = useParams<{ sourceId: string }>();
  const sourceId = modelLoaded ? selectedId : sourceIdParam.sourceId;

  const descriptor = (location.state as { descriptor?: string } | null)?.descriptor;

  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<CreateSchemaFormHandle>(null);

  const editorSelected = sourceId ? "form-editor" : "smart-editor";
  const [codeText, setCodeText] = useState<string>("");

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

  const { data: sources = [] } = useQuery<Source[], Error>(
    "sources",
    () => fetchData<Source[]>(`${API_URL}/api/sources`)
  );

  const existingSources = React.useMemo(() => {
    return Array.isArray(sources) ? sources.map((s) => s.name) : [];
  }, [sources]);

  const handleCodeChange = (value: string) => {
    setCodeText(value);
  };

  const createNewSource = async (payload: Record<string, unknown>) => {
    setIsLoading(true);
    const response = await createPost(
      `${API_URL}/api/sources`,
      payload as unknown as Payload
    );
    if (response.error) {
      addNotification(
        "danger",
        "Source creation failed",
        `Failed to create ${(payload as { name: string }).name}: ${response.error}`
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

  const handleSubmitCode = () => {
    try {
      const finalPayload = detectAndParseFormat(codeText, "source");

      if (!finalPayload || !finalPayload.name?.trim()) {
        addNotification("danger", "Validation failed", "Connector name is required.");
        return;
      }
      if (!finalPayload.type?.trim()) {
        addNotification("danger", "Validation failed", "Connector type is required.");
        return;
      }

      // Verify uniqueness of name
      if (existingSources.includes(finalPayload.name.trim())) {
        addNotification(
          "danger",
          "Validation failed",
          `Source with name '${finalPayload.name.trim()}' already exists.`
        );
        return;
      }

      createNewSource(finalPayload);
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
      if (!sourceId) {
        return (
          <Alert variant="warning" isInline title={t("common:emptyState.title", { val: t("source:source") })}>
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
          sourceId={sourceId}
          onSubmit={createNewSource}
          existingNames={existingSources}
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
            downloadFileName="source-config"
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
          title={t("source:create.title")}
          subtitle={t("source:create.description")}
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
