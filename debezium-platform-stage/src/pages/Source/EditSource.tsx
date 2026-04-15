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
import { PencilAltIcon } from "@patternfly/react-icons";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  editPut,
  fetchData,
  fetchDataTypeTwo,
  Payload,
  Source,
} from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { useNotification } from "../../appLayout/AppNotificationContext";
import { PageHeader } from "@patternfly/react-component-groups";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "react-query";
import { ConnectorSchema } from "../../apis/types";
import { getConnectorTypeName } from "../../utils/helpers";
import CreateSourceSchemaForm, {
  CreateSourceSchemaFormHandle,
} from "@components/CreateSourceSchemaForm";
import SourceSchemaReviewView from "@components/SourceSchemaReviewView";
import EditConfirmationModel from "../components/EditConfirmationModel";
import { resolveSourcePageViewMode } from "./sourcePageNavigation";

const EditSource: React.FunctionComponent = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { sourceId: routeSourceId } = useParams<{ sourceId: string }>();
  const [searchParams] = useSearchParams();
  const queryStateParam = searchParams.get("state");

  const [viewMode, setViewMode] = useState<boolean>(() =>
    resolveSourcePageViewMode(location.state, queryStateParam)
  );
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<{
    values: Record<string, string>;
    setError: (fieldId: string, error: string | undefined) => void;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const formRef = useRef<CreateSourceSchemaFormHandle>(null);
  const { addNotification } = useNotification();
  const queryClient = useQueryClient();

  useEffect(() => {
    setViewMode(
      resolveSourcePageViewMode(location.state, searchParams.get("state"))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [routeSourceId, location.key]);

  const {
    data: source,
    isLoading: isSourceLoading,
    error: sourceQueryError,
  } = useQuery<Source, Error>(
    ["source", routeSourceId],
    async () => {
      const response = await fetchDataTypeTwo<Source>(
        `${API_URL}/api/sources/${routeSourceId}`
      );
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data as Source;
    },
    { enabled: !!routeSourceId }
  );

  const connectorType = source?.type;
  const descriptorPath = connectorType
    ? `source-connector/${connectorType}`
    : null;

  const {
    data: connectorSchema,
    isLoading: isSchemaLoading,
    error: schemaError,
  } = useQuery<ConnectorSchema, Error>(
    ["connectorSchema", descriptorPath],
    () => fetchData<ConnectorSchema>(`${API_URL}/api/catalog/${descriptorPath}`),
    { enabled: !!descriptorPath }
  );

  const sourceErrorMessage =
    sourceQueryError instanceof Error ? sourceQueryError.message : sourceQueryError
      ? String(sourceQueryError)
      : null;

  const handleSchemaSubmit = async (payload: Record<string, unknown>) => {
    setIsLoading(true);
    const response = await editPut<Source>(
      `${API_URL}/api/sources/${routeSourceId}`,
      payload as unknown as Payload
    );
    if (response.error) {
      addNotification(
        "danger",
        t("statusMessage:edit.failedTitle"),
        t("statusMessage:edit.failedDescription", {
          val: `${(response.data as Source)?.name ?? source?.name}: ${response.error}`,
        })
      );
    } else {
      addNotification(
        "success",
        t("statusMessage:edit.successTitle"),
        t("statusMessage:edit.successDescription", {
          val: `${(response.data as Source)?.name ?? source?.name}`,
        })
      );
      await queryClient.invalidateQueries(["source", routeSourceId]);
      setViewMode(true);
    }
    setIsLoading(false);
  };

  const handleEditConfirm = (
    values: Record<string, string>,
    setError: (fieldId: string, error: string | undefined) => void
  ) => {
    void values;
    void setError;
    formRef.current?.submit();
  };

  const onSaveClick = () => {
    const form = formRef.current;
    if (!form?.validate()) {
      addNotification(
        "danger",
        t("statusMessage:edit.failedTitle", { defaultValue: "Update failed" }),
        form?.getLastValidationFailureBody() ??
          t("source:form.validationFailedGeneric", { defaultValue: "Please fill all required fields." })
      );
      return;
    }
    setPendingSave({ values: {}, setError: () => {} });
    setIsWarningOpen(true);
  };

  const renderLoading = () => (
    <PageSection isFilled>
      <Skeleton fontSize="2xl" width="40%" />
      <br />
      <Skeleton fontSize="md" width="60%" />
      <br />
      <Skeleton fontSize="md" width="80%" />
    </PageSection>
  );

  const renderContent = () => {
    if (!routeSourceId) {
      return (
        <PageSection isFilled>
          <Alert variant="warning" isInline title="No source selected">
            Missing source id in the URL.
          </Alert>
        </PageSection>
      );
    }

    if (isSourceLoading) {
      return renderLoading();
    }

    if (sourceErrorMessage) {
      return (
        <PageSection isFilled>
          <Alert variant="danger" isInline title="Failed to load source">
            {sourceErrorMessage}
          </Alert>
        </PageSection>
      );
    }

    if (!source) {
      return null;
    }

    if (isSchemaLoading) {
      return renderLoading();
    }

    if (schemaError) {
      return (
        <PageSection isFilled>
          <Alert variant="danger" isInline title="Failed to load connector schema">
            {schemaError.message}
          </Alert>
        </PageSection>
      );
    }

    if (!connectorSchema) {
      return null;
    }

    return (
      <PageSection isFilled>
        {viewMode ? (
          <SourceSchemaReviewView
            source={source}
            connectorSchema={connectorSchema}
            dataType={source.type}
          />
        ) : (
          <CreateSourceSchemaForm
            key={source.id}
            ref={formRef}
            connectorSchema={connectorSchema}
            sourceId={source.type}
            dataType={source.type}
            initialSource={source}
            onSubmit={handleSchemaSubmit}
          />
        )}
      </PageSection>
    );
  };

  return (
    <>
      {viewMode ? (
        <PageHeader
          title={source?.name || t("source:edit.title")}
          subtitle={`${getConnectorTypeName(source?.type || "")} source connector.`}
          actionMenu={
            <Button
              variant="secondary"
              ouiaId="edit-source"
              icon={<PencilAltIcon />}
              onClick={() => setViewMode(false)}
            >
              {t("edit")}
            </Button>
          }
        />
      ) : (
        <PageHeader
          title={
            <>
              {t("edit")} <i>{source?.name}</i>
            </>
          }
          subtitle={t("source:edit.description")}
        />
      )}

      {renderContent()}

      {!viewMode && source && connectorSchema && (
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
                    onSaveClick();
                  }}
                >
                  {t("saveChanges")}
                </Button>
              </ActionListItem>
              <ActionListItem>
                <Button variant="link" onClick={() => setViewMode(true)}>
                  {t("cancel")}
                </Button>
              </ActionListItem>
            </ActionListGroup>
          </ActionList>
        </PageSection>
      )}

      <EditConfirmationModel
        type="source"
        isWarningOpen={isWarningOpen}
        setIsWarningOpen={setIsWarningOpen}
        pendingSave={pendingSave}
        setPendingSave={setPendingSave}
        handleEdit={handleEditConfirm}
      />
    </>
  );
};

export { EditSource };
