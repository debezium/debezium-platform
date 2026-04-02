import {
  Alert,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Divider,
  Flex,
  FlexItem,
  Gallery,
  GalleryItem,
  Content,
  PageSection,
  Skeleton,
} from "@patternfly/react-core";
import React, { useCallback, useState } from "react";
import { fetchData, Source } from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { useQuery } from "react-query";
import SourceDestinationSelectionList from "../SourceDestinationSelectionList";
import { CatalogGrid } from "@components/CatalogGrid";
import { CreateSource } from "@sourcePage/CreateSource";
import { Catalog, CatalogApiResponse } from "../../apis/types";

type PipelineSourceModelProps = {
  onSourceSelection: (source: Source) => void;
};

const CatalogSkeleton: React.FC = () => (
  <Gallery hasGutter className="custom-gallery">
    {Array.from({ length: 6 }).map((_, i) => (
      <GalleryItem key={i}>
        <Card>
          <CardHeader>
            <Skeleton shape="square" width="60px" height="60px" />
            <CardBody>
              <Skeleton width="70%" height="20px" />
            </CardBody>
          </CardHeader>
          <CardBody>
            <Skeleton width="100%" height="14px" />
            <br />
            <Skeleton width="80%" height="14px" />
          </CardBody>
        </Card>
      </GalleryItem>
    ))}
  </Gallery>
);

const PipelineSourceModel: React.FC<PipelineSourceModelProps> = ({
  onSourceSelection,
}) => {
  const id1 = "pipeline-source-select";
  const id2 = "pipeline-source-create";
  const [selectedSource, setSelectedSource] = useState<string>("");

  const {
    data: sourceList = [],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    error: _sourceError,
    isLoading: isSourceLoading,
  } = useQuery<Source[], Error>("sources", () =>
    fetchData<Source[]>(`${API_URL}/api/sources`)
  );

  const {
    data: sourceCatalog = [],
    error: catalogError,
    isLoading: isCatalogLoading,
    refetch: refetchCatalog,
  } = useQuery<Catalog[], Error>("sourceConnectorCatalog", async () => {
    const response = await fetchData<CatalogApiResponse>(
      `${API_URL}/api/catalog`
    );
    return (response.components["source-connector"] ?? []).map((entry) => ({
      ...entry,
      role: "source",
    }));
  });

  const [userSelection, setUserSelection] = useState<string | null>(null);

  const isCreateChecked = userSelection !== null 
    ? userSelection 
    : (!isSourceLoading && sourceList.length === 0 ? id2 : id1);

  const selectSource = useCallback(
    (sourceId: string) => {
      setSelectedSource(sourceId);
    },
    [setSelectedSource]
  );

  const onChange = (event: React.FormEvent<HTMLInputElement>) => {
    setUserSelection(event.currentTarget.id);
  };

  return (
    <>
      <Flex alignItems={{ default: "alignItemsStretch" }}>
        <FlexItem className="creation_flow-card_selection">
          <Card
            id="select-existing-source"
            isSelectable
            isSelected={isCreateChecked === id1}
          >
            <CardHeader
              selectableActions={{
                selectableActionId: id1,
                selectableActionAriaLabelledby: "select-existing-source",
                name: "pipeline-source",
                variant: "single",
                onChange,
              }}
            >
              <CardTitle>Select a Source</CardTitle>
            </CardHeader>
            <CardBody>
              Select a already configured source from the list below
            </CardBody>
          </Card>
        </FlexItem>

        <FlexItem className="creation_flow-card_selection">
          <Card
            id="create-new-source"
            isSelectable
            isSelected={isCreateChecked === id2}
          >
            <CardHeader
              selectableActions={{
                selectableActionId: id2,
                selectableActionAriaLabelledby: "create-new-source",
                name: "pipeline-source",
                variant: "single",
                onChange,
              }}
            >
              <CardTitle>Create a source</CardTitle>
            </CardHeader>
            <CardBody>Create a new source for your data pipeline.</CardBody>
          </Card>
        </FlexItem>
      </Flex>
      <Divider style={{ marginTop: "10px" }} />
      {isCreateChecked === id2 &&
        (selectedSource === "" ? (
          <Content component="p">
            <b>
              {" "}
              Select the type of source you want to connect from the list below,
              once you select a connector you can configure it using form or
              smart editor option.
            </b>
          </Content>
        ) : (
          <Content component="p">
            <b>
              Fill out the below form or use the smart editor to setup a new
              source connector. If you already have a configuration file, you
              can setup a new source connector by uploading it in the smart
              editor.
            </b>
          </Content>
        ))}

      {isCreateChecked === id1 ? (
        <SourceDestinationSelectionList
          tableType="source"
          data={sourceList}
          onSelection={onSourceSelection}
        />
      ) : selectedSource === "" ? (
        catalogError ? (
          <PageSection>
            <Alert
              variant="danger"
              title="Failed to load source catalog"
              actionLinks={
                <Button variant="link" onClick={() => refetchCatalog()}>
                  Retry
                </Button>
              }
            >
              {catalogError.message}
            </Alert>
          </PageSection>
        ) : isCatalogLoading ? (
          <CatalogSkeleton />
        ) : (
          <CatalogGrid
            onCardSelect={selectSource}
            catalogType="source"
            isAddButtonVisible={false}
            displayType={"grid"}
            searchResult={sourceCatalog}
          />
        )
      ) : (
        <CreateSource
          modelLoaded={true}
          selectedId={selectedSource}
          selectSource={selectSource}
          onSelection={onSourceSelection}
        />
      )}
    </>
  );
};

export default PipelineSourceModel;
