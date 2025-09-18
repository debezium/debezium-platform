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
  Skeleton,
} from "@patternfly/react-core";
import ConnectorImage from "./ComponentImage";
import { StarIcon } from "@patternfly/react-icons";
import { Catalog } from "src/apis/types";
import "./ConnectionCatalogGrid.css";
import { ConnectionsSchema } from "src/apis";

export interface IConnectionCatalogGridProps {
  onCardSelect: (selectId: string, role: string) => void;
  searchResult: Catalog[];
  displayType: "grid" | "list";
  connectionsSchema: ConnectionsSchema[];
  isSchemaLoading: boolean;
  error: Error | null;
}

const ConnectionCatalogGrid: React.FunctionComponent<IConnectionCatalogGridProps> = ({
  onCardSelect,
  searchResult,
  displayType,
  connectionsSchema,
  isSchemaLoading,

}) => {
 


  const onCardClick = (id: string, role: string) => {
    onCardSelect(id, role);
  };



  return (
    <PageSection>
      {displayType === "grid" ? (

        <Gallery hasGutter className="custom-gallery">
          {
            isSchemaLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <GalleryItem key={`skeleton-${index}`}>
                  <Skeleton shape="square" />
                </GalleryItem>
              ))
            ) : (
              searchResult.map((item) => (
                <GalleryItem key={item.id}>
                  <Card isClickable variant={"default"} className="custom-connection-card">
                    <CardHeader
                      className="custom-connection-card-header"
                      // actions={{ actions: item.role === "source" ? <Tooltip content={<div>{t("source")}</div>}><DataSourceIcon style={{ outline: "none" }} size={150} /></Tooltip> : <Tooltip content={<div>{t("destination")}</div>}><DataSinkIcon style={{ outline: "none" }} size={150} /></Tooltip>, hasNoOffset: false }}
                      actions={{ actions: connectionsSchema.find((schema) => schema.type.toLowerCase() === item.id.toLowerCase()) && <StarIcon style={{ outline: "none" }} size={150} /> }}
                      selectableActions={{
                        onClickAction: () => onCardClick(item.id, item.role),
                        selectableActionAriaLabelledby: `catalog-card-id-${item.name}`,
                      }}
                    >
                      <ConnectorImage connectorType={item.id} />
                      <CardTitle id={`catalog-card-id-${item.name}`}>
                        {item.name}
                      </CardTitle>

                      <div className="catalog-subtitle"> {item.role === "source" ? "Source connection" : "Destination connection"}</div>

                    </CardHeader>
                    <CardBody>{item.description}</CardBody>
                  </Card>
                </GalleryItem>
              )))
          }
        </Gallery>
      ) : (
        <DataList
          aria-label="Simple data list example"
          isCompact

        >

          {searchResult.map((item) => (
            <DataListItem
              aria-labelledby="simple-item1"
              id={item.id}
              key={item.id}
              onClick={() => onCardClick(item.id, item.role)}
              style={{ cursor: "pointer" }}
            >
              <DataListItemRow>
                <DataListItemCells
                  dataListCells={[
                    <DataListCell
                      key="primary content"
                      isFilled={false}
                      style={{
                        minWidth: "80px",
                      }}
                    >
                      <ConnectorImage connectorType={item.id} />
                    </DataListCell>,
                    <DataListCell key="secondary content">
                      <Flex direction={{ default: "column" }}>
                        <FlexItem>
                          <Content component="h3" style={{ marginBottom: "0" }}>{item.name}</Content>
                          <div className="catalog-subtitle"> {item.role === "source" ? "Source connection" : "Destination connection"}</div>
                        </FlexItem>
                        <FlexItem>
                          <Content component="p">{item.description}</Content>
                        </FlexItem>
                      </Flex>
                    </DataListCell>,
                    
                    <DataListCell isFilled={false} alignRight key="support validation">
                      {connectionsSchema.find((schema) => schema.type.toLowerCase() === item.id.toLowerCase()) && <StarIcon style={{ outline: "none" }} size={150} />}
                  </DataListCell>
                  ]}
                />
              </DataListItemRow>
            </DataListItem>
          ))}
        </DataList>
      )}
    </PageSection>
  );
};

export { ConnectionCatalogGrid };
