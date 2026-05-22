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
} from "@patternfly/react-core";
import ConnectorImage from "./ComponentImage";
import { ExternalLinkAltIcon, PlusCircleIcon } from "@patternfly/react-icons";
import "./CatalogGrid.css";
import { Catalog } from "src/apis/types";
import { openDBZIssues } from "@utils/helpers";
import { useTranslation } from "react-i18next";

export interface ICatalogGridProps {
  onCardSelect: (selectId: string, role?: string) => void;
  catalogType?: "destination" | "source" | "connection";
  isAddButtonVisible?: boolean;
  searchResult: Catalog[];
  displayType: "grid" | "list";
  showSubtitle?: boolean;
}

const CatalogGrid: React.FunctionComponent<ICatalogGridProps> = ({
  onCardSelect,
  catalogType,
  isAddButtonVisible = false,
  searchResult,
  displayType,
  showSubtitle = false,
}) => {
  const { t } = useTranslation();
  const [selectedDataListItemId, setSelectedDataListItemId] =
    React.useState("");

  const isConnectionMode = catalogType === "connection";

  const onCardClick = (id: string, role?: string) => {
    onCardSelect(id, role);
  };

  const onSelectDataListItem = (
    _event: React.MouseEvent | React.KeyboardEvent,
    id: string
  ) => {
    setSelectedDataListItemId(id);
    const item = searchResult.find(r => r.class === id);
    onCardSelect(id, item?.role);
  };

  const handleInputChange = (
    _event: React.FormEvent<HTMLInputElement>,
    id: string
  ) => {
    setSelectedDataListItemId(id);
    const item = searchResult.find(r => r.class === id);
    onCardSelect(id, item?.role);
  };

  return (
    <PageSection data-tour="catalog-grid">
      {displayType === "grid" ? (
        <Gallery hasGutter className="custom-gallery">
          {/* <GalleryItem>
            <Card isClickable variant={"default"} onClick={() => onCardSelect("")}>
              <CardHeader
                selectableActions={{
                  onClickAction: () => { },
                  selectableActionAriaLabelledby: `catalog-card-id-fill-out-form`,
                }}
              >
                <DataSourceIcon
                  color="#0066CC"
                  style={{ fontSize: "xxx-large", paddingBottom: "10px", height: "60px" }}
                />
                <CardTitle id={`catalog-card-id-fill-out-form`}>
                  {capitalize(catalogType)}
                </CardTitle>
              </CardHeader>
              <CardBody>
                {t("source:catalog.rawEditorDescription", { val: catalogType })}
              </CardBody>
            </Card>
          </GalleryItem> */}

          {searchResult.map((item) => (
            <GalleryItem key={item.class} data-tour={`catalog-card-${item.class}`}>
              <Card
                variant={"default"}
                className={`catalog-grid-card-${catalogType || 'connection'}`}
                onClick={() => onCardClick(item.class, item.role)}
              >
                <CardHeader
                  className={isConnectionMode ? "custom-connection-card-header" : undefined}
                >
                  <ConnectorImage connectorType={item.class} />
                  <CardTitle id={`catalog-card-id-${item.name}`} className="catalog-card-title">
                    {item.name}
                  </CardTitle>
                  {showSubtitle && item.role && (
                    <div className="catalog-subtitle">
                      {item.role === "source" ? `${t("source")} ${t("connection:connection")}` : `${t("destination")} ${t("connection:connection")}`}
                    </div>
                  )}
                </CardHeader>
                <CardBody className="catalog-card-description">{item.description}</CardBody>
              </Card>
            </GalleryItem>
          ))}
          {isAddButtonVisible && (
            <GalleryItem>
              <Card variant={"secondary"} onClick={openDBZIssues} className={`catalog-grid-card-${catalogType || 'connection'}`}>
                <CardHeader>
                  <PlusCircleIcon
                    color="#0066CC"
                    style={{ fontSize: "60px", paddingBottom: "10px" }}
                  />
                  <CardTitle id={`catalog-card-id-fill-out-form`} className="catalog-card-title">
                    {t("requestNewResource.title", { val: catalogType })} <ExternalLinkAltIcon />
                  </CardTitle>
                </CardHeader>
                <CardBody className="catalog-card-description">
                  {t("requestNewResource.description", { val: catalogType })}
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

          {/* <DataListItem aria-labelledby="code-connector">
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
                    <DataSourceIcon
                      color="#0066CC"
                      style={{ fontSize: "xxx-large", }}
                    />
                  </DataListCell>,
                  <DataListCell key="secondary content" onClick={openDBZIssues}>
                    <Flex direction={{ default: "column" }}>
                      <FlexItem>
                        <Content component="h3">
                          Source
                        </Content>
                      </FlexItem>
                      <FlexItem>
                        <Content component="p">
                          {t("source:catalog.rawEditorDescription", { val: catalogType })}
                        </Content>
                      </FlexItem>
                    </Flex>
                  </DataListCell>,
                ]}
              />
            </DataListItemRow>
          </DataListItem> */}

          {searchResult.map((item) => (
            <DataListItem
              aria-labelledby="simple-item1"
              id={item.class}
              key={item.class}
              onClick={() => onCardClick(item.class, item.role)}
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
                        maxWidth: isConnectionMode ? "80px" : "80px",
                      }}
                    >
                      <ConnectorImage connectorType={item.class} />
                    </DataListCell>,
                    <DataListCell key="secondary content">
                      <Flex direction={{ default: "column" }}>
                        <FlexItem>
                          <Content component="h3" className="catalog-card-title" style={showSubtitle ? { marginBottom: "0" } : undefined}>
                            {item.name}
                          </Content>
                          {showSubtitle && item.role && (
                            <div className="catalog-subtitle">
                              {item.role === "source" ? `${t("source")} ${t("connection:connection")}` : `${t("destination")} ${t("connection:connection")}`}
                            </div>
                          )}
                        </FlexItem>
                        <FlexItem>
                          <Content component="p" className="catalog-card-description">{item.description}</Content>
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
                        maxWidth: "80px",
                        // display: "flex",
                        // justifyContent: "center",
                      }}
                    >
                      <PlusCircleIcon
                        color="#0066CC"
                        style={{ fontSize: "xxx-large", paddingBottom: "10px" }}
                      />
                    </DataListCell>,
                    <DataListCell key="secondary content" onClick={openDBZIssues}>
                      <Flex direction={{ default: "column" }}>
                        <FlexItem>
                          <Content component="h3" className="catalog-card-title">
                            {t("requestNewResource.title", { val: catalogType })} <ExternalLinkAltIcon />
                          </Content>
                        </FlexItem>
                        <FlexItem>
                          <Content component="p" className="catalog-card-description">
                            {t("requestNewResource.description", { val: catalogType })}
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
