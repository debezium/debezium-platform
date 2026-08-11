import * as React from "react";
import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Button,
  ButtonType,
  PageSection,
} from "@patternfly/react-core";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPost, fetchData, TransformData, TransformPayload } from "src/apis";
import { API_URL } from "@utils/constants";
import { useNotification } from "@appContext/AppNotificationContext";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { PageHeader } from "@patternfly/react-component-groups";
import CreateTransformForm, {
  CreateTransformFormHandle,
} from "@components/CreateTransformForm";

export interface ICreateTransformsProps {
  modelLoaded?: boolean;
  onSelection?: (selection: TransformData[]) => void;
  sourceType?: string;
}

const CreateTransforms: React.FunctionComponent<ICreateTransformsProps> = ({
  modelLoaded,
  onSelection,
  sourceType,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addNotification } = useNotification();
  const formRef = useRef<CreateTransformFormHandle>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { data: existingTransforms = [] } = useQuery<TransformData[]>(
    "transforms",
    () => fetchData<TransformData[]>(`${API_URL}/api/transforms`)
  );

  const existingNames = React.useMemo(() => {
    return Array.isArray(existingTransforms)
      ? existingTransforms.map((tr) => tr.name)
      : [];
  }, [existingTransforms]);

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
      modelLoaded && onSelection?.([response.data as TransformData]);
      addNotification(
        "success",
        `Create successful`,
        `Transform "${payload.name}" created successfully.`
      );
      !modelLoaded && navigate("/transform");
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
        <CreateTransformForm
          ref={formRef}
          onSubmit={createNewTransform}
          existingNames={existingNames}
          sourceType={sourceType}
          {...(modelLoaded ? { defaultLayoutMode: "tabs" as const } : {})}
        />
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
                isDisabled={isLoading}
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
