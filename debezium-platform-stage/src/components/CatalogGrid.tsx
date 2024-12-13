/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Gallery,
  GalleryItem,
  PageSection,
  // Tile,
} from "@patternfly/react-core";
import ConnectorImage from "./ComponentImage";
import destinationCatalog from "../__mocks__/data/DestinationCatalog.json";
import sourceCatalog from "../__mocks__/data/SourceCatalog.json";
import { PlusCircleIcon } from "@patternfly/react-icons";
import "./CatalogGrid.css";

export interface ICatalogGridProps {
  onCardSelect: (selectId: string) => void;
  catalogType: "destination" | "source";
  isAddButtonVisible: boolean;
}

const CatalogGrid: React.FunctionComponent<ICatalogGridProps> = ({
  onCardSelect,
  catalogType,
  isAddButtonVisible,
}) => {
  const catalog =
    catalogType === "destination" ? destinationCatalog : sourceCatalog;

  const onCardClick = (id: string) => {
    onCardSelect(id);
  };

  return (
    <PageSection>
      <Gallery hasGutter className="custom-gallery">
        {catalog.map((item) => (
          <GalleryItem key={item.id}>
             <Card isClickable variant={ 'default'}>
            <CardHeader
              selectableActions={{
                onClickAction: () => onCardClick(item.id),
                selectableActionAriaLabelledby: `catalog-card-id-${item.name}`
              }}
            >
              <ConnectorImage connectorType={item.id} />
              <CardTitle id={`catalog-card-id-${item.name}`}>{item.name}</CardTitle>
            </CardHeader>
            <CardBody>{item.description}</CardBody>
          </Card>
          </GalleryItem>
        ))}
        {isAddButtonVisible && (
          <GalleryItem>
            <Card isClickable variant={ 'secondary'}>
            <CardHeader
              selectableActions={{
                onClickAction: () => {},
                selectableActionAriaLabelledby: `catalog-card-id-fill-out-form`
              }}
            >
              <PlusCircleIcon color="#0066CC" style={{fontSize:"xxx-large", paddingBottom: "10px"}} />
              <CardTitle id={`catalog-card-id-fill-out-form`}>Request new {catalogType}</CardTitle>
            </CardHeader>
            <CardBody>Fill our a form to request a new {catalogType}.</CardBody>
          </Card>
          </GalleryItem>
        )}
      </Gallery>
    </PageSection>
  );
};

export { CatalogGrid };
