/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Content,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Flex,
  FlexItem,
  Gallery,
  GalleryItem,
  PageSection,
  // Tile,
} from "@patternfly/react-core";
import ConnectorImage from "./ComponentImage";
import { ExternalLinkAltIcon, PlusCircleIcon } from "@patternfly/react-icons";
import "./CatalogGrid.css";
import { Catalog } from "src/apis/types";
import { openDBZJira } from "@utils/helpers";

export interface ICatalogGridProps {
  onCardSelect: (selectId: string) => void;
  catalogType: "destination" | "source";
  isAddButtonVisible: boolean;
  searchResult: Catalog[];
  displayType: "grid" | "list";
}

const CatalogGrid: React.FunctionComponent<ICatalogGridProps> = ({
  onCardSelect,
  catalogType,
  isAddButtonVisible,
  searchResult,
  displayType,
}) => {
  const [selectedDataListItemId, setSelectedDataListItemId] =
    React.useState("");

  const onCardClick = (id: string) => {
    onCardSelect(id);
  };

  const onSelectDataListItem = (
    _event: React.MouseEvent | React.KeyboardEvent,
    id: string
  ) => {
    setSelectedDataListItemId(id);
    onCardSelect(id);
  };

  const handleInputChange = (
    _event: React.FormEvent<HTMLInputElement>,
    id: string
  ) => {
    setSelectedDataListItemId(id);
    onCardSelect(id);
  };

  return (
    <PageSection>
      {displayType === "grid" ? (
        <Gallery hasGutter className="custom-gallery">
          {searchResult.map((item) => (
            <GalleryItem key={item.id}>
              <Card isClickable variant={"default"}>
                <CardHeader
                  selectableActions={{
                    onClickAction: () => onCardClick(item.id),
                    selectableActionAriaLabelledby: `catalog-card-id-${item.name}`,
                  }}
                >
                  <ConnectorImage connectorType={item.id} />
                  <CardTitle id={`catalog-card-id-${item.name}`}>
                    {item.name}
                  </CardTitle>
                </CardHeader>
                <CardBody>{item.description}</CardBody>
              </Card>
            </GalleryItem>
          ))}
          {isAddButtonVisible && (
            <GalleryItem>
              <Card isClickable variant={"secondary"} onClick={openDBZJira}>
                <CardHeader
                  selectableActions={{
                    onClickAction: () => {},
                    selectableActionAriaLabelledby: `catalog-card-id-fill-out-form`,
                  }}
                >
                  <PlusCircleIcon
                    color="#0066CC"
                    style={{ fontSize: "xxx-large", paddingBottom: "10px" }}
                  />
                  <CardTitle id={`catalog-card-id-fill-out-form`}>
                    Request new {catalogType} <ExternalLinkAltIcon />
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  Fill our a request to create a new {catalogType}.
                </CardBody>
              </Card>
            </GalleryItem>
          )}
        </Gallery>
      ) : (
        <DataList
          aria-label="Simple data list example"
          isCompact
          selectedDataListItemId={selectedDataListItemId}
          onSelectDataListItem={onSelectDataListItem}
          onSelectableRowChange={handleInputChange}
        >
          {searchResult.map((item) => (
            <DataListItem
              aria-labelledby="simple-item1"
              id={item.id}
              key={item.id}
            >
              <DataListItemRow>
                <DataListItemCells
                  dataListCells={[
                    <DataListCell
                      key="primary content"
                      isFilled={false}
                      style={{
                        minWidth: "80px",
                        // display: "flex",
                        // justifyContent: "center",
                      }}
                    >
                      <ConnectorImage connectorType={item.id} />
                    </DataListCell>,
                    <DataListCell key="secondary content">
                      <Flex direction={{ default: "column" }}>
                        <FlexItem>
                          <Content component="h3">{item.name}</Content>
                        </FlexItem>
                        <FlexItem>
                          <Content component="p">{item.description}</Content>
                        </FlexItem>
                      </Flex>
                    </DataListCell>,
                  ]}
                />
              </DataListItemRow>
            </DataListItem>
          ))}
          {isAddButtonVisible && (
            <DataListItem aria-labelledby="new-connector-request">
              <DataListItemRow>
                <DataListItemCells
                  dataListCells={[
                    <DataListCell
                      key="primary content"
                      isFilled={false}
                      style={{
                        minWidth: "80px",
                        // display: "flex",
                        // justifyContent: "center",
                      }}
                    >
                      <PlusCircleIcon
                        color="#0066CC"
                        style={{ fontSize: "xxx-large", paddingBottom: "10px" }}
                      />
                    </DataListCell>,
                    <DataListCell key="secondary content" onClick={openDBZJira}>
                      <Flex direction={{ default: "column" }}>
                        <FlexItem>
                          <Content component="h3">
                            {" "}
                            Request new {catalogType}
                          </Content>
                        </FlexItem>
                        <FlexItem>
                          <Content component="p">
                            {" "}
                            Fill our a request to create a new {catalogType}.
                          </Content>
                        </FlexItem>
                      </Flex>
                    </DataListCell>,
                  ]}
                />
              </DataListItemRow>
            </DataListItem>
          )}
        </DataList>
      )}
    </PageSection>
  );
};

export { CatalogGrid };
