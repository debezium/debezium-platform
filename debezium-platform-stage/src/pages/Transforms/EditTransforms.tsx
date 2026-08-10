import * as React from "react";
import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Alert,
  Button,
  ButtonType,
  Icon,
  PageSection,
  Skeleton,
} from "@patternfly/react-core";
import { PencilAltIcon, RhUiDataProcessorIcon } from "@patternfly/react-icons";
import { useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  editPut,
  fetchData,
  fetchDataTypeTwo,
  TransformData,
  TransformPayload,
} from "src/apis";
import { API_URL } from "@utils/constants";
import { useNotification } from "@appContext/AppNotificationContext";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "react-query";
import { PageHeader } from "@patternfly/react-component-groups";
import CreateTransformForm, {
  CreateTransformFormHandle,
} from "@components/CreateTransformForm";
import TransformReviewView from "@components/TransformReviewView";
import EditConfirmationModel from "../components/EditConfirmationModel";

export interface IEditTransformsProps {
  onSelection?: (selection: TransformData) => void;
}

const EditTransforms: React.FunctionComponent<IEditTransformsProps> = ({
  onSelection,
}) => {
  const { transformId } = useParams<{ transformId: string }>();
  const [searchParams] = useSearchParams();
  const initialState = searchParams.get("state") as "view" | "edit" | null;
  const [viewMode, setViewMode] = useState<boolean>(initialState === "view");
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<{
    values: Record<string, string>;
    setError: (fieldId: string, error: string | undefined) => void;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const formRef = useRef<CreateTransformFormHandle>(null);
  const { addNotification } = useNotification();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: existingTransforms = [] } = useQuery<TransformData[], Error>(
    "transforms",
    () => fetchData<TransformData[]>(`${API_URL}/api/transforms`)
  );

  const existingNames = React.useMemo(() => {
    return Array.isArray(existingTransforms)
      ? existingTransforms.map((tr) => tr.name)
      : [];
  }, [existingTransforms]);

  const {
    data: transformData,
    isLoading: isFetchLoading,
    error: fetchError,
  } = useQuery<TransformData, Error>(
    ["transform", transformId],
    async () => {
      const response = await fetchDataTypeTwo<TransformData>(
        `${API_URL}/api/transforms/${transformId}`
      );
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data as TransformData;
    },
    { enabled: !!transformId }
  );

  const handleSchemaSubmit = async (payload: TransformPayload) => {
    setIsLoading(true);
    const response = await editPut(
      `${API_URL}/api/transforms/${transformData?.id}`,
      payload
    );
    if (response.error) {
      addNotification(
        "danger",
        `Transform edit failed`,
        `Failed to edit ${payload.name}: ${response.error}`
      );
    } else {
      onSelection?.(response.data as TransformData);
      addNotification(
        "success",
        `Edit successful`,
        `Transform "${(response.data as TransformData).name}" edited successfully.`
      );
      await queryClient.invalidateQueries(["transform", transformId]);
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
          t("transform:form.validationFailedGeneric", {
            defaultValue: "Please fill all required fields.",
          })
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
    if (!transformId) {
      return (
        <PageSection isFilled>
          <Alert variant="warning" isInline title="No transform selected">
            Missing transform id in the URL.
          </Alert>
        </PageSection>
      );
    }

    if (isFetchLoading) {
      return renderLoading();
    }

    if (fetchError) {
      return (
        <PageSection isFilled>
          <Alert variant="danger" isInline title="Failed to load transform">
            {fetchError.message}
          </Alert>
        </PageSection>
      );
    }

    if (!transformData) {
      return null;
    }

    return (
      <PageSection isFilled>
        {viewMode ? (
          <TransformReviewView transform={transformData} />
        ) : (
          <CreateTransformForm
            key={transformData.id}
            ref={formRef}
            initialTransform={transformData}
            onSubmit={handleSchemaSubmit}
            existingNames={existingNames}
          />
        )}
      </PageSection>
    );
  };

  return (
    <>
      {viewMode ? (
        <PageHeader
          title={transformData?.name || t("transform:edit.title")}
          subtitle={
            transformData?.type
              ? `${transformData.type} transform.`
              : t("transform:edit.description")
          }
          icon={
            <Icon size="2xl" className="custom-header_icon">
              <RhUiDataProcessorIcon />
            </Icon>
          }
          actionMenu={
            <Button
              variant="secondary"
              ouiaId="Primary"
              icon={<PencilAltIcon />}
              onClick={() => {
                setViewMode(false);
              }}
            >
              {t("edit")}
            </Button>
          }
        />
      ) : (
        <PageHeader
          title={t("transform:edit.title")}
          subtitle={t("transform:edit.description")}
          icon={
            <Icon size="2xl" className="custom-header_icon">
              <RhUiDataProcessorIcon />
            </Icon>
          }
        />
      )}

      {renderContent()}

      {!viewMode && transformData && (
        <PageSection className="pf-m-sticky-bottom" isFilled={false}>
          <ActionList>
            <ActionListGroup>
              <ActionListItem>
                <Button
                  variant="primary"
                  isLoading={isLoading}
                  isDisabled={isLoading}
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
        type="transform"
        isWarningOpen={isWarningOpen}
        setIsWarningOpen={setIsWarningOpen}
        pendingSave={pendingSave}
        setPendingSave={setPendingSave}
        handleEdit={handleEditConfirm}
      />
    </>
  );
};

export { EditTransforms };
