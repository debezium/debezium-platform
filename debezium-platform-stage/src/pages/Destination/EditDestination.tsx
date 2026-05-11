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
  Destination,
} from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { useNotification } from "../../appLayout/AppNotificationContext";
import { PageHeader } from "@patternfly/react-component-groups";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "react-query";
import { ConnectorSchema } from "../../apis/types";
import { getConnectorTypeName } from "../../utils/helpers";
import CreateDestinationSchemaForm, {
  CreateDestinationSchemaFormHandle,
} from "@components/CreateDestinationSchemaForm";
import DestinationSchemaReviewView from "@components/DestinationSchemaReviewView";
import EditConfirmationModel from "../components/EditConfirmationModel";
import { resolveDestinationPageViewMode } from "./destinationPageNavigation";

const EditDestination: React.FunctionComponent = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { destinationId: routeDestinationId } = useParams<{ destinationId: string }>();
  const [searchParams] = useSearchParams();
  const queryStateParam = searchParams.get("state");

  const [viewMode, setViewMode] = useState<boolean>(() =>
    resolveDestinationPageViewMode(location.state, queryStateParam)
  );
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<{
    values: Record<string, string>;
    setError: (fieldId: string, error: string | undefined) => void;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const formRef = useRef<CreateDestinationSchemaFormHandle>(null);
  const { addNotification } = useNotification();
  const queryClient = useQueryClient();

  useEffect(() => {
    setViewMode(
      resolveDestinationPageViewMode(location.state, searchParams.get("state"))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [routeDestinationId, location.key]);

  const {
    data: destination,
    isLoading: isDestinationLoading,
    error: destinationQueryError,
  } = useQuery<Destination, Error>(
    ["destination", routeDestinationId],
    async () => {
      const response = await fetchDataTypeTwo<Destination>(
        `${API_URL}/api/destinations/${routeDestinationId}`
      );
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data as Destination;
    },
    { enabled: !!routeDestinationId }
  );

  const connectorType = destination?.type;
  const descriptorPath = connectorType
    ? `server-sink/${connectorType}`
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

  const destinationErrorMessage =
    destinationQueryError instanceof Error ? destinationQueryError.message : destinationQueryError
      ? String(destinationQueryError)
      : null;

  const handleSchemaSubmit = async (payload: Record<string, unknown>) => {
    setIsLoading(true);
    const response = await editPut<Destination>(
      `${API_URL}/api/destinations/${routeDestinationId}`,
      payload as unknown as Payload
    );
    if (response.error) {
      addNotification(
        "danger",
        t("statusMessage:edit.failedTitle"),
        t("statusMessage:edit.failedDescription", {
          val: `${(response.data as Destination)?.name ?? destination?.name}: ${response.error}`,
        })
      );
    } else {
      addNotification(
        "success",
        t("statusMessage:edit.successTitle"),
        t("statusMessage:edit.successDescription", {
          val: `${(response.data as Destination)?.name ?? destination?.name}`,
        })
      );
      await queryClient.invalidateQueries(["destination", routeDestinationId]);
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
          t("destination:form.validationFailedGeneric", { defaultValue: "Please fill all required fields." })
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
    if (!routeDestinationId) {
      return (
        <PageSection isFilled>
          <Alert variant="warning" isInline title="No destination selected">
            Missing destination id in the URL.
          </Alert>
        </PageSection>
      );
    }

    if (isDestinationLoading) {
      return renderLoading();
    }

    if (destinationErrorMessage) {
      return (
        <PageSection isFilled>
          <Alert variant="danger" isInline title="Failed to load destination">
            {destinationErrorMessage}
          </Alert>
        </PageSection>
      );
    }

    if (!destination) {
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
          <DestinationSchemaReviewView
            destination={destination}
            connectorSchema={connectorSchema}
            dataType={destination.type}
          />
        ) : (
          <CreateDestinationSchemaForm
            key={destination.id}
            ref={formRef}
            connectorSchema={connectorSchema}
            destinationId={destination.type}
            dataType={destination.type}
            initialDestination={destination}
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
          title={destination?.name || t("destination:edit.title")}
          subtitle={`${getConnectorTypeName(destination?.type || "")} destination connector.`}
          actionMenu={
            <Button
              variant="secondary"
              ouiaId="edit-destination"
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
              {t("edit")} <i>{destination?.name}</i>
            </>
          }
          subtitle={t("destination:edit.description")}
        />
      )}

      {renderContent()}

      {!viewMode && destination && connectorSchema && (
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
        type="destination"
        isWarningOpen={isWarningOpen}
        setIsWarningOpen={setIsWarningOpen}
        pendingSave={pendingSave}
        setPendingSave={setPendingSave}
        handleEdit={handleEditConfirm}
      />
    </>
  );
};

export { EditDestination };

// Made with Bob
