import * as React from "react";
import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Button,
  ButtonType,
  PageSection,
  Skeleton,
} from "@patternfly/react-core";
import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPost, fetchData, TransformData, TransformPayload } from "src/apis";
import { API_URL } from "@utils/constants";
import { useNotification } from "@appContext/AppNotificationContext";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "react-query";
import { PageHeader } from "@patternfly/react-component-groups";
import CreateTransformForm, {
  CreateTransformFormHandle,
} from "@components/CreateTransformForm";

export interface ICreateTransformsProps {
  modelLoaded?: boolean;
  onSelection?: (selection: TransformData[]) => void;
  sourceType?: string;
  initialTransform?: TransformData;
}

const CreateTransforms: React.FunctionComponent<ICreateTransformsProps> = ({
  modelLoaded,
  onSelection,
  sourceType,
  initialTransform,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { addNotification } = useNotification();
  const queryClient = useQueryClient();
  const formRef = useRef<CreateTransformFormHandle>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fromId = modelLoaded ? null : searchParams.get("from");

  const { data: existingTransforms = [], isLoading: isTransformsLoading } = useQuery<TransformData[]>(
    "transforms",
    () => fetchData<TransformData[]>(`${API_URL}/api/transforms`)
  );

  const existingNames = React.useMemo(() => {
    return Array.isArray(existingTransforms)
      ? existingTransforms.map((tr) => tr.name)
      : [];
  }, [existingTransforms]);

  const seedTransform = React.useMemo(() => {
    if (initialTransform) return initialTransform;
    if (!fromId) return undefined;
    return existingTransforms.find((tr) => String(tr.id) === fromId);
  }, [initialTransform, fromId, existingTransforms]);

  const isCopy = !!seedTransform;

  const createNewTransform = async (payload: TransformPayload) => {
    setIsLoading(true);
    const response = await createPost(`${API_URL}/api/transforms`, payload);
    if (response.error) {
      addNotification(
        "danger",
        `Transform creation failed`,
        `Failed to create ${payload.name}: ${response.error}`
      );
    } else {
      const created = response.data as TransformData;
      await queryClient.invalidateQueries("transforms");
      await queryClient.invalidateQueries("transform");
      modelLoaded && onSelection?.([created]);
      addNotification(
        "success",
        `Create successful`,
        `Transform "${payload.name}" created successfully.`
      );
      if (!modelLoaded) {
        if (isCopy && created?.id) {
          navigate(`/transform/${created.id}?state=view`);
        } else {
          navigate("/transform");
        }
      }
    }
    setIsLoading(false);
  };

  return (
    <>
      {!modelLoaded && (
        <PageHeader
          title={t("transform:create.title")}
          subtitle={t("transform:create.description")}
        />
      )}

      <PageSection
        isFilled
        padding={modelLoaded ? { default: "noPadding" } : undefined}
      >
        {!!fromId && isTransformsLoading ? (
          <>
            <Skeleton fontSize="md" width="40%" />
            <br />
            <Skeleton fontSize="md" width="70%" />
          </>
        ) : (
          <CreateTransformForm
            key={seedTransform ? `copy-${seedTransform.id}` : "create"}
            ref={formRef}
            onSubmit={createNewTransform}
            existingNames={existingNames}
            sourceType={sourceType}
            initialTransform={seedTransform}
            isCopy={isCopy}
            {...(modelLoaded ? { defaultLayoutMode: "tabs" as const } : {})}
          />
        )}
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
                isDisabled={isLoading || (!!fromId && isTransformsLoading)}
                type={ButtonType.submit}
                onClick={(e) => {
                  e.preventDefault();
                  formRef.current?.submit();
                }}
              >
                {t("transform:create.title")}
              </Button>
            </ActionListItem>
            <ActionListItem>
              {!modelLoaded && (
                <Button variant="link" onClick={() => navigate("/transform")}>
                  {t("back")}
                </Button>
              )}
            </ActionListItem>
          </ActionListGroup>
        </ActionList>
      </PageSection>
    </>
  );
};

export { CreateTransforms };
