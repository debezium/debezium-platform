import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Divider,
  Flex,
  FlexItem,
  Content,
} from "@patternfly/react-core";
import React, { useState } from "react";
import { fetchData, TransformData } from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { useQuery } from "react-query";
import TransformSelectionList from "@components/TransformSelectionList";
import { CreateTransforms } from "src/pages/Transforms";
import { useTranslation } from "react-i18next";


type PipelineTransformModelProps = {
  onTransformSelection: (transform: TransformData[]) => void;
};

const PipelineTransformModel: React.FC<PipelineTransformModelProps> = ({
  onTransformSelection,
}) => {
  const { t } = useTranslation();
  const id1 = "pipeline-transform-select";
  const id2 = "pipeline-transform-create";

  const {
    data: transformList = [],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    error: _transformError,
    isLoading: isTransformLoading,
  } = useQuery<TransformData[], Error>("transform", () =>
    fetchData<TransformData[]>(`${API_URL}/api/transforms`)
  );

  const [userSelection, setUserSelection] = useState<string | null>(null);

  const isCreateChecked = userSelection !== null 
    ? userSelection 
    : (!isTransformLoading && transformList.length === 0 ? id2 : id1);

  const onChange = (event: React.FormEvent<HTMLInputElement>) => {
    setUserSelection(event.currentTarget.id);
  };

  return (
    <>
      <Flex alignItems={{ default: "alignItemsStretch" }}>
        <FlexItem className="creation_flow-card_selection">
          <Card
            id="select-existing-transform"
            isSelectable
            isSelected={isCreateChecked === id1}
          >
            <CardHeader
              selectableActions={{
                selectableActionId: id1,
                selectableActionAriaLabelledby: "select-existing-transform",
                name: "transform-transform",
                variant: "single",
                onChange,
              }}
            >
              <CardTitle>{t('transform:transformModal.title')}</CardTitle>
            </CardHeader>
            <CardBody>
            {t('transform:transformModal.description')}
            </CardBody>
          </Card>
        </FlexItem>

        <FlexItem className="creation_flow-card_selection">
          <Card
            id="create-new-transform"
            isSelectable
            isSelected={isCreateChecked === id2}
          >
            <CardHeader
              selectableActions={{
                selectableActionId: id2,
                selectableActionAriaLabelledby: "create-new-transform",
                name: "pipeline-transform",
                variant: "single",
                onChange,
              }}
            >
              <CardTitle>{t('transform:transformModal.createTitle')}</CardTitle>
            </CardHeader>
            <CardBody>{t('transform:transformModal.createDescription')}</CardBody>
          </Card>
        </FlexItem>
      </Flex>
      <Divider style={{ marginTop: "10px" }} />
      {isCreateChecked === id2 && (
        <Content component="p">
          <b>
            {t('transform:transformModal.formDescription')}
          </b>
        </Content>
      )}

      {isCreateChecked === id1 ? (
        <TransformSelectionList
          data={transformList}
          onSelection={onTransformSelection}
        />
      ) : (
        <CreateTransforms
          modelLoaded={true}
          onSelection={onTransformSelection}
        />
      )}
    </>
  );
};

export default PipelineTransformModel;
