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
import React, { useEffect, useState } from "react";
import { fetchData, TransformData } from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { useQuery } from "react-query";
import TransformSelectionList from "@components/TransformSelectionList";
import { CreateTransforms } from "src/pages/Transforms";

type TransformPipelineModelProps = {
  onTransformSelection: (source: TransformData) => void;
};

const TransformPipelineModel: React.FC<TransformPipelineModelProps> = ({
  onTransformSelection,
}) => {
  const id1 = "pipeline-transform-select";
  const id2 = "pipeline-transform-create";
  const [isCreateChecked, setIsCreateChecked] = useState(id1);

  const {
    data: transformList = [],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    error: _transformError,
    isLoading: isTransformLoading,
  } = useQuery<TransformData[], Error>("transform", () =>
    fetchData<TransformData[]>(`${API_URL}/api/transforms`)
  );

  useEffect(() => {
    if (transformList.length === 0 && isTransformLoading === false) {
      setIsCreateChecked(id2);
    }
  }, [transformList, isTransformLoading]);

  const onChange = (event: React.FormEvent<HTMLInputElement>) => {
    setIsCreateChecked(event.currentTarget.id);
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
              <CardTitle>Select a transform</CardTitle>
            </CardHeader>
            <CardBody>
              Select a already configured transform from the list below
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
              <CardTitle>Create a transform</CardTitle>
            </CardHeader>
            <CardBody>Create a new transform for your data pipeline.</CardBody>
          </Card>
        </FlexItem>
      </Flex>
      <Divider style={{ marginTop: "10px" }} />
      {isCreateChecked === id2 && (
        <Content component="p">
          <b>
            Fill out the below form or use the smart editor to setup a new
            source connector. If you already have a configuration file, you can
            setup a new source connector by uploading it in the smart editor.
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

export default TransformPipelineModel;
