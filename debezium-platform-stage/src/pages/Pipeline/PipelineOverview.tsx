import ConnectorImage from "@components/ComponentImage";
import CompositionFlow from "@components/dataFlow/CompositionFlow";
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
import { FC, useEffect, useState } from "react";
import { Pipeline, Source, Destination, fetchDataTypeTwo } from "src/apis/apis";
import comingSoonImage from "../../assets/comingSoon.png";
import "./PipelineOverview.css";

type PipelineOverviewProp = {
  pipelineId: string;
};

const PipelineOverview: FC<PipelineOverviewProp> = ({ pipelineId }) => {
  const [pipeline, setPipeline] = useState<Pipeline>();
  const [source, setSource] = useState<Source>();
  const [destination, setDestination] = useState<Destination>();
  const [isFetchLoading, setIsFetchLoading] = useState<boolean>(true);
  const [isSourceFetchLoading, setIsSourceFetchLoading] =
    useState<boolean>(true);
  const [isDestinationFetchLoading, setIsDestinationFetchLoading] =
    useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPipeline = async () => {
      setIsFetchLoading(true);
      const response = await fetchDataTypeTwo<Pipeline>(
        `${API_URL}/api/pipelines/${pipelineId}`
      );

      if (response.error) {
        setError(response.error);
      } else {
        setPipeline(response.data as Pipeline);
      }

      setIsFetchLoading(false);
    };

    fetchPipeline();
  }, [pipelineId]);

  useEffect(() => {
    const fetchSource = async () => {
      setIsSourceFetchLoading(true);
      const response = await fetchDataTypeTwo<Source>(
        `${API_URL}/api/sources/${pipeline!.source.id}`
      );

      if (response.error) {
        setError(response.error);
      } else {
        setSource(response.data as Source);
      }
      setIsSourceFetchLoading(false);
    };

    if (pipeline?.source?.id) {
      fetchSource();
    }
  }, [pipeline]);

  useEffect(() => {
    const fetchDestination = async () => {
      setIsDestinationFetchLoading(true);
      const response = await fetchDataTypeTwo<Destination>(
        `${API_URL}/api/destinations/${pipeline!.destination.id}`
      );

      if (response.error) {
        setError(response.error);
      } else {
        setDestination(response.data as Destination);
      }
      setIsDestinationFetchLoading(false);
    };

    if (pipeline?.source?.id) {
      fetchDestination();
    }
  }, [pipeline]);

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
                      labels={({ datum }: { datum: { x: string; y: number } }) =>
                        datum.x ? `${datum.x}: ${datum.y}%` : null
                      }
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

      <GridItem span={3} rowSpan={1}>
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
                    <div style={{ display: 'flex', alignItems: 'center' }}>
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
        <Card ouiaId="BasicCard" isFullHeight>
          <CardTitle>Pipeline composition</CardTitle>
          <CardBody>
            <CompositionFlow
              sourceName={source?.name || ""}
              sourceType={source?.type || ""}
              destinationName={destination?.name || ""}
              destinationType={destination?.type || ""}
            />
          </CardBody>
        </Card>
      </GridItem>

      <GridItem span={3} rowSpan={1}>
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
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <ConnectorImage
                      connectorType={destination?.type || ""}
                      size={25}
                      />
                      <Content
                      component="p"
                      className="pipeline-overview__card-description"
                      style={{ marginLeft: '8px' }}
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
