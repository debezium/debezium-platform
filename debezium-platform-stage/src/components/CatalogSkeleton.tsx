import {
  Card,
  CardBody,
  CardHeader,
  Gallery,
  GalleryItem,
  Skeleton,
} from "@patternfly/react-core";
import * as React from "react";

const CatalogSkeleton: React.FC = () => (
  <Gallery hasGutter className="custom-gallery">
    {Array.from({ length: 6 }).map((_, i) => (
      <GalleryItem key={i}>
        <Card>
          <CardHeader>
            <Skeleton shape="square" width="60px" height="60px" />
            <CardBody style={{ marginTop: "5px", padding: "0px" }}>
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

export default CatalogSkeleton;
