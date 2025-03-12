import ConnectorImage from "@components/ComponentImage";
import {
  ChartDonutUtilization,
  Chart,
  ChartVoronoiContainer,
  ChartThemeColor,
  ChartAxis,
  ChartGroup,
  ChartBar,
} from "@patternfly/react-charts/victory";
import {
  Grid,
  GridItem,
  Card,
  CardBody,
  CardTitle,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Skeleton,
  Content,
} from "@patternfly/react-core";
import { API_URL } from "@utils/constants";
import { getConnectorTypeName } from "@utils/helpers";
import { FC, memo, useEffect, useState } from "react";
import {
  Pipeline,
  Source,
  Destination,
  fetchDataTypeTwo,
  Transform,
} from "src/apis/apis";
import comingSoonImage from "../../assets/comingSoon.png";
import "./PipelineOverview.css";
declare global {
  interface Window {
    EVENT_BUFFER_SIZE: number;
  }
}
import CompositionFlow from "@components/pipelineDesigner/CompositionFlow";
import { ReactFlowProvider } from "reactflow";

type PipelineOverviewProp = {
  pipelineId: string;
};

const PipelineOverview: FC<PipelineOverviewProp> = ({ pipelineId }) => {
  const [source, setSource] = useState<Source>();
  const [transforms, setTransforms] = useState<Transform[]>([]);
  const [destination, setDestination] = useState<Destination>();
  const [isFetchLoading, setIsFetchLoading] = useState<boolean>(true);
  const [isSourceFetchLoading, setIsSourceFetchLoading] =
    useState<boolean>(true);
  const [isDestinationFetchLoading, setIsDestinationFetchLoading] =
    useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsFetchLoading(true);
      try {
        const pipelineResponse = await fetchDataTypeTwo<Pipeline>(
          `${API_URL}/api/pipelines/${pipelineId}`
        );

        if (pipelineResponse.error) {
          throw new Error(pipelineResponse.error);
        }

        const pipelineData = pipelineResponse.data as Pipeline;
        setTransforms(pipelineData.transforms as Transform[]);

        if (pipelineData?.source?.id && pipelineData?.destination?.id) {
          const [sourceResponse, destinationResponse] = await Promise.all([
            fetchDataTypeTwo<Source>(
              `${API_URL}/api/sources/${pipelineData.source.id}`
            ),
            fetchDataTypeTwo<Destination>(
              `${API_URL}/api/destinations/${pipelineData.destination.id}`
            ),
          ]);

          if (!sourceResponse.error) {
            setSource(sourceResponse.data as Source);
          }

          if (!destinationResponse.error) {
            setDestination(destinationResponse.data as Destination);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsFetchLoading(false);
        setIsSourceFetchLoading(false);
        setIsDestinationFetchLoading(false);
      }
    };

    fetchData();
  }, [pipelineId]);

  const CompositionFlowMemo = memo(CompositionFlow);

  useEffect(() => {
    // Store original event buffer size
    const originalSize = window.EVENT_BUFFER_SIZE;
    // Reduce event buffer size for charts to improve performance
    window.EVENT_BUFFER_SIZE = 100;
    return () => {
      // Restore original size on unmount
      window.EVENT_BUFFER_SIZE = originalSize;
    };
  }, []);

  if (isFetchLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <Grid hasGutter>
      <GridItem span={12}>
        <Card ouiaId="BasicCard">
          <CardBody>
            <Grid hasGutter>
              <GridItem span={4} className="pipeline-overview__card-border">
                <Card
                  ouiaId="BasicCard"
                  isPlain
                  className="pipeline-overview__coming-soon-card"
                >
                  <div className="overlay">
                    <img src={comingSoonImage} alt="Coming Soon" />
                  </div>
                  <CardTitle>Queue usage</CardTitle>
                  <CardBody>
                    <ChartDonutUtilization
                      ariaDesc="Queue utilization"
                      ariaTitle="Queue utilization"
                      constrainToVisibleArea
                      data={{ x: "GBps capacity", y: 45 }}
                      labels={({
                        datum,
                      }: {
                        datum: { x: string; y: number };
                      }) => (datum.x ? `${datum.x}: ${datum.y}%` : null)}
                      legendData={[
                        { name: `Storage capacity: 45%` },
                        { name: "Unused: 55%" },
                      ]}
                      legendOrientation="vertical"
                      name="queue-usage"
                      padding={{
                        bottom: 20,
                        left: 20,
                        right: 225, // Adjusted to accommodate legend
                        top: 20,
                      }}
                      title={`45%`}
                      thresholds={[{ value: 60 }, { value: 90 }]}
                      width={435}
                    />
                  </CardBody>
                </Card>
              </GridItem>
              <GridItem span={8}>
                <Card
                  ouiaId="BasicCard"
                  isPlain
                  className="pipeline-overview__coming-soon-card"
                >
                  <div className="overlay">
                    <img src={comingSoonImage} alt="Coming Soon" />
                  </div>
                  <CardTitle>Events</CardTitle>
                  <CardBody>
                    <Chart
                      ariaDesc="Events chart"
                      ariaTitle="Events"
                      containerComponent={<ChartVoronoiContainer />}
                      domain={{ y: [0, 9000] }}
                      domainPadding={{ x: [30, 25] }}
                      height={220}
                      themeColor={ChartThemeColor.multiOrdered}
                      name="events-chart"
                      padding={{
                        bottom: 60,
                        left: 60,
                        right: 30,
                        top: 20,
                      }}
                      width={900}
                    >
                      <ChartAxis />
                      <ChartAxis dependentAxis showGrid />
                      <ChartGroup offset={11} horizontal>
                        <ChartBar
                          data={[
                            { name: "Delete", x: "Delete", y: 400 },
                            { name: "Update", x: "Update", y: 2000 },
                            { name: "Insert", x: "Insert", y: 7000 },
                          ]}
                        />
                      </ChartGroup>
                    </Chart>
                  </CardBody>
                </Card>
              </GridItem>
            </Grid>
          </CardBody>
        </Card>
      </GridItem>
      <GridItem span={12} rowSpan={1}>
        <Card ouiaId="BasicCard" isFullHeight>
          <CardTitle>Pipeline composition</CardTitle>
          <CardBody
            style={{ minHeight: "300px", height: "100%", width: "100%" }}
          >
            <ReactFlowProvider>
              <CompositionFlowMemo
                sourceName={source?.name || ""}
                sourceType={source?.type || ""}
                selectedTransform={transforms}
                destinationName={destination?.name || ""}
                destinationType={destination?.type || ""}
              />
            </ReactFlowProvider>
          </CardBody>
        </Card>
      </GridItem>

      <GridItem span={6} rowSpan={1}>
        <Card ouiaId="BasicCard">
          <CardTitle>Source</CardTitle>
          <CardBody>
            <DescriptionList>
              <DescriptionListGroup>
                <DescriptionListTerm>Name</DescriptionListTerm>
                <DescriptionListDescription>
                  {isSourceFetchLoading ? (
                    <Skeleton screenreaderText="Loading contents" />
                  ) : (
                    source?.name
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Type</DescriptionListTerm>
                <DescriptionListDescription>
                  {isSourceFetchLoading ? (
                    <Skeleton screenreaderText="Loading contents" />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <ConnectorImage
                        connectorType={source?.type || ""}
                        size={25}
                      />
                      <Content
                        component="p"
                        className="pipeline-overview__card-description"
                      >
                        {getConnectorTypeName(source?.type || "")}
                      </Content>
                    </div>
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Description</DescriptionListTerm>
                <DescriptionListDescription>
                  {isSourceFetchLoading ? (
                    <Skeleton screenreaderText="Loading contents" />
                  ) : (
                    source?.description
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>

              <DescriptionListGroup>
                <DescriptionListTerm>Schema</DescriptionListTerm>
                <DescriptionListDescription>
                  {isSourceFetchLoading ? (
                    <Skeleton screenreaderText="Loading contents" />
                  ) : (
                    source?.schema
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
          </CardBody>
        </Card>
      </GridItem>

      <GridItem span={6} rowSpan={1}>
        <Card ouiaId="BasicCard">
          <CardTitle>Destination</CardTitle>
          <CardBody>
            <DescriptionList>
              <DescriptionListGroup>
                <DescriptionListTerm>Name</DescriptionListTerm>
                <DescriptionListDescription>
                  {isDestinationFetchLoading ? (
                    <Skeleton screenreaderText="Loading contents" />
                  ) : (
                    destination?.name
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Type</DescriptionListTerm>
                <DescriptionListDescription>
                  {isDestinationFetchLoading ? (
                    <Skeleton screenreaderText="Loading contents" />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <ConnectorImage
                        connectorType={destination?.type || ""}
                        size={25}
                      />
                      <Content
                        component="p"
                        className="pipeline-overview__card-description"
                        style={{ marginLeft: "8px" }}
                      >
                        {getConnectorTypeName(destination?.type || "")}
                      </Content>
                    </div>
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Description</DescriptionListTerm>
                <DescriptionListDescription>
                  {isDestinationFetchLoading ? (
                    <Skeleton screenreaderText="Loading contents" />
                  ) : (
                    destination?.description
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>

              <DescriptionListGroup>
                <DescriptionListTerm>Schema</DescriptionListTerm>
                <DescriptionListDescription>
                  {isDestinationFetchLoading ? (
                    <Skeleton screenreaderText="Loading contents" />
                  ) : (
                    destination?.schema
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
          </CardBody>
        </Card>
      </GridItem>
    </Grid>
  );
};

export default PipelineOverview;
