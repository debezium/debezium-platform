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
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createPost,
  editPut,
  fetchData,
  fetchDataTypeTwo,
  Pipeline,
  TransformData,
  TransformPayload,
} from "src/apis";
import { API_URL } from "@utils/constants";
import { nextCopyName } from "@utils/helpers";
import { useNotification } from "@appContext/AppNotificationContext";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "react-query";
import { PageHeader } from "@patternfly/react-component-groups";
import CreateTransformForm, {
  CreateTransformFormHandle,
} from "@components/CreateTransformForm";
import TransformReviewView from "@components/TransformReviewView";
import EditConfirmationModel from "../components/EditConfirmationModel";
import { getActivePipelineCount } from "@components/UsedIn";
import { resolveTransformPageViewMode, transformPageNavState } from "./transformPageNavigation";

export interface IEditTransformsProps {
  onSelection?: (selection: TransformData) => void;
}

const EditTransforms: React.FunctionComponent<IEditTransformsProps> = ({
  onSelection,
}) => {
  const { transformId } = useParams<{ transformId: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryStateParam = searchParams.get("state");
  const [viewMode, setViewMode] = useState<boolean>(() =>
    resolveTransformPageViewMode(location.state, queryStateParam)
  );
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<{
    values: Record<string, string>;
    setError: (fieldId: string, error: string | undefined) => void;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const saveIntentRef = useRef<"update" | "copy">("update");

  const formRef = useRef<CreateTransformFormHandle>(null);
  const { addNotification } = useNotification();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  useEffect(() => {
    setViewMode(
      resolveTransformPageViewMode(location.state, searchParams.get("state"))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transformId, location.key]);

  const { data: existingTransforms = [] } = useQuery<TransformData[], Error>(
    "transforms",
    () => fetchData<TransformData[]>(`${API_URL}/api/transforms`)
  );

  const { data: pipelineList, isSuccess: isPipelineListLoaded } = useQuery<
    Pipeline[],
    Error
  >("pipelines", () => fetchData<Pipeline[]>(`${API_URL}/api/pipelines`));

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

  const usedInCount =
    transformData && pipelineList
      ? getActivePipelineCount(pipelineList, transformData.id, "transform")
      : 0;

  const handleSchemaSubmit = async (payload: TransformPayload) => {
    setIsLoading(true);
    if (saveIntentRef.current === "copy") {
      const name =
        payload.name === transformData?.name
          ? nextCopyName(transformData.name, existingNames)
          : payload.name;
      const response = await createPost(`${API_URL}/api/transforms`, {
        ...payload,
        name,
      });
      if (response.error) {
        addNotification(
          "danger",
          `Transform creation failed`,
          `Failed to create ${name}: ${response.error}`
        );
      } else {
        const created = response.data as TransformData;
        addNotification(
          "success",
          `Create successful`,
          `Transform "${created.name}" created successfully.`
        );
        await queryClient.invalidateQueries("transforms");
        if (created?.id) {
          setViewMode(true);
          navigate(`/transform/${created.id}?state=view`, {
            state: transformPageNavState.view,
          });
        }
      }
      setIsLoading(false);
      return;
    }

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
    saveIntentRef.current = "update";
    formRef.current?.submit();
  };

  const handleSaveAsCopy = () => {
    saveIntentRef.current = "copy";
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
    if (isPipelineListLoaded && usedInCount === 0) {
      saveIntentRef.current = "update";
      form.submit();
      return;
    }
    setPendingSave({ values: {}, setError: () => {} });
    setIsWarningOpen(true);
  };

  const navigateToDuplicate = () => {
    if (transformData?.id) {
      navigate(`/transform/create_transform?from=${transformData.id}`);
    }
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
            <ActionList>
              <ActionListGroup>
                <ActionListItem>
                  <Button
                    variant="primary"
                    ouiaId="Primary"
                    icon={<PencilAltIcon />}
                    onClick={() => {
                      setViewMode(false);
                    }}
                  >
                    {t("edit")}
                  </Button>
                </ActionListItem>
                <ActionListItem>
                  <Button
                    variant="secondary"
                    isDisabled={!transformData}
                    onClick={navigateToDuplicate}
                  >
                    {t("duplicate")}
                  </Button>
                </ActionListItem>
              </ActionListGroup>
            </ActionList>
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
        usedInCount={usedInCount}
        onSaveAsCopy={handleSaveAsCopy}
      />
    </>
  );
};

export { EditTransforms };
