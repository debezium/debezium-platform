import ConnectorImage from "@components/ComponentImage";
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
  CardHeader,
  Button,
} from "@patternfly/react-core";
import { API_URL } from "@utils/constants";
import { getConnectorTypeName } from "@utils/helpers";
import { FC, memo, useCallback, useEffect, useState } from "react";
import {
  Pipeline,
  Source,
  Destination,
  Connection,
  fetchDataTypeTwo,
  TransformData,
} from "src/apis/apis";
import "./PipelineOverview.css";
declare global {
  interface Window {
    EVENT_BUFFER_SIZE: number;
  }
}
import CompositionFlow from "@components/pipelineDesigner/CompositionFlow";
import { ReactFlowProvider } from "@xyflow/react";
import { DownloadIcon, PencilAltIcon } from "@patternfly/react-icons";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { sourcePageNavState } from "@sourcePage/sourcePageNavigation";
import { useNotification } from "@appContext/AppNotificationContext";
import {
  generatePropertiesContent,
  triggerPropertiesDownload,
} from "@utils/generateServerConfig";

export type PipelineOverviewProp = {
  pipelineId: string;
  activeTabKey: string;
  pipeline: Pipeline;
};

const PipelineOverview: FC<PipelineOverviewProp> = ({ pipelineId, activeTabKey, pipeline }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addNotification } = useNotification();

  const navigateTo = (url: string) => {
    navigate(url);
  };
  const [source, setSource] = useState<Source>();
  const [destination, setDestination] = useState<Destination>();
  const [isFetchLoading, setIsFetchLoading] = useState<boolean>(true);
  const [isSourceFetchLoading, setIsSourceFetchLoading] =
    useState<boolean>(true);
  const [isDestinationFetchLoading, setIsDestinationFetchLoading] =
    useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportLoading, setIsExportLoading] = useState<boolean>(false);
  const transforms = pipeline.transforms ?? [];

  const handleExportServerConfig = useCallback(async () => {
    if (!source || !destination || !pipeline) return;
    setIsExportLoading(true);
    try {
      const transformFetches = transforms.map((t) =>
        fetchDataTypeTwo<TransformData>(`${API_URL}/api/transforms/${t.id}`)
      );
      const connectionFetches: Promise<{ data?: Connection | null; error?: string }>[] = [];
      if (source.connection?.id) {
        connectionFetches.push(
          fetchDataTypeTwo<Connection>(
            `${API_URL}/api/connections/${source.connection.id}`
          )
        );
      } else {
        connectionFetches.push(Promise.resolve({ data: null }));
      }
      if (destination.connection?.id) {
        connectionFetches.push(
          fetchDataTypeTwo<Connection>(
            `${API_URL}/api/connections/${destination.connection.id}`
          )
        );
      } else {
        connectionFetches.push(Promise.resolve({ data: null }));
      }

      const [transformResults, [sourceConnRes, destConnRes]] =
        await Promise.all([
          Promise.all(transformFetches),
          Promise.all(connectionFetches),
        ]);

      const resolvedTransforms = transformResults
        .filter((r) => !r.error && r.data)
        .map((r) => r.data as TransformData);

      const sourceConn =
        !sourceConnRes.error && sourceConnRes.data
          ? (sourceConnRes.data as Connection)
          : null;
      const destConn =
        !destConnRes.error && destConnRes.data
          ? (destConnRes.data as Connection)
          : null;

      const content = generatePropertiesContent(
        source.name,
        source,
        sourceConn,
        destination,
        destConn,
        resolvedTransforms
      );
      triggerPropertiesDownload(`${pipeline.name}.properties`, content);
    } catch {
      addNotification(
        "danger",
        t("pipeline:userActions.exportServerConfig"),
        t("pipeline:userActions.exportServerConfigError")
      );
    } finally {
      setIsExportLoading(false);
    }
  }, [source, destination, transforms, pipeline, addNotification, t]);

  useEffect(() => {
    if (activeTabKey !== "overview") return;

    const sourceId = pipeline.source?.id;
    const destinationId = pipeline.destination?.id;
    if (!sourceId || !destinationId) {
      setIsFetchLoading(false);
      return;
    }

    let cancelled = false;

    const fetchResources = async () => {
      setIsFetchLoading(true);
      setIsSourceFetchLoading(true);
      setIsDestinationFetchLoading(true);
      setError(null);

      try {
        const [sourceResponse, destinationResponse] = await Promise.all([
          fetchDataTypeTwo<Source>(
            `${API_URL}/api/sources/${sourceId}`
          ),
          fetchDataTypeTwo<Destination>(
            `${API_URL}/api/destinations/${destinationId}`
          ),
        ]);

        if (cancelled) {
          return;
        }

        if (sourceResponse.error || destinationResponse.error) {
          throw new Error(sourceResponse.error ?? destinationResponse.error);
        }

        setSource(sourceResponse.data as Source);
        setDestination(destinationResponse.data as Destination);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setIsFetchLoading(false);
          setIsSourceFetchLoading(false);
          setIsDestinationFetchLoading(false);
        }
      }
    };

    void fetchResources();

    return () => {
      cancelled = true;
    };
  }, [activeTabKey, pipeline.source?.id, pipeline.destination?.id]);

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
    return <div>{t("loading")}</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <Grid hasGutter>
      {/* <GridItem span={12}>
        <Card ouiaId="BasicCard">
          <CardBody>
            <Grid hasGutter>
              <GridItem span={4} className="pipeline-overview__card-border">
                <Card
                  ouiaId="BasicCard"
                  isPlain
                  className="pipeline-overview__coming-soon-card"
                >
                  <div className="overlay" style={darkMode ? { background: "rgba(41, 41, 41, 0.6)" } : {}}>
                    <img src={comingSoonImage} alt="Coming Soon" />
                  </div>
                  <CardTitle>{t("pipeline:overview.queueUsage")}</CardTitle>
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
                  <div className="overlay" style={darkMode ? { background: "rgba(41, 41, 41, 0.6)" } : {}}>
                    <img src={comingSoonImage} alt="Coming Soon" />
                  </div>
                  <CardTitle>{t("pipeline:overview.events")}</CardTitle>
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
      </GridItem> */}
      <GridItem span={12} rowSpan={1}>
        <Card ouiaId="BasicCard" isFullHeight>
          <CardHeader
            actions={{
              actions: (
                <>
                  <Button
                    variant="link"
                    icon={<DownloadIcon />}
                    onClick={() => void handleExportServerConfig()}
                    isLoading={isExportLoading}
                    isDisabled={isExportLoading}
                  >
                    {t("pipeline:userActions.exportServerConfig")}
                  </Button>
                  <Button
                    variant="link"
                    icon={<PencilAltIcon />}
                    onClick={() => navigateTo(`/pipeline/${pipelineId}/edit`)}
                  >
                    {t("edit")}
                  </Button>
                </>
              ),
            }}
          >
            <CardTitle>{t("pipeline:overview.pipelineComposition")}</CardTitle>
          </CardHeader>

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
          <CardHeader
            actions={{
              actions: (
                <Button
                  variant="link"
                  icon={<PencilAltIcon />}
                  onClick={() =>
                    navigate(`/source/${source?.id}?state=edit`, {
                      state: sourcePageNavState.edit,
                    })
                  }
                >
                  {t("edit")}
                </Button>
              ),
            }}
          >
            <CardTitle>{t("source")}</CardTitle>
          </CardHeader>
          <CardBody>
            <DescriptionList isCompact>
              <DescriptionListGroup>
                <DescriptionListTerm>{t("name")}</DescriptionListTerm>
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
                <DescriptionListTerm>{t("description")}</DescriptionListTerm>
                <DescriptionListDescription>
                  {isSourceFetchLoading ? (
                    <Skeleton screenreaderText="Loading contents" />
                  ) : (
                    source?.description
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>{t("form.subHeading.title")}</DescriptionListTerm>
                <DescriptionListDescription>
                  <DescriptionList isCompact isHorizontal horizontalTermWidthModifier={{
                    default: '12ch',
                    sm: '15ch',
                    md: '20ch',
                    lg: '28ch',
                    xl: '30ch',
                    '2xl': '35ch'
                  }} aria-label="Compact horizontal">
                    {source?.config && Object.keys(source.config).map((key) => {
                      return (
                        <DescriptionListGroup key={key}>
                          <DescriptionListTerm>{key}</DescriptionListTerm>
                          <DescriptionListDescription>{source.config[key]}</DescriptionListDescription>
                        </DescriptionListGroup>
                      )
                    })}

                  </DescriptionList>
                </DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
          </CardBody>
        </Card>
      </GridItem>

      <GridItem span={6} rowSpan={1}>
        <Card ouiaId="BasicCard">
          <CardHeader
            actions={{
              actions: (
                <Button
                  variant="link"
                  icon={<PencilAltIcon />}
                  onClick={() =>
                    navigateTo(
                      `/destination/${destination?.id}`
                    )
                  }
                >
                  {t("edit")}
                </Button>
              ),
            }}
          >
            <CardTitle>{t("destination")}</CardTitle>
          </CardHeader>
          <CardBody>
            <DescriptionList isCompact>
              <DescriptionListGroup>
                <DescriptionListTerm>{t("name")}</DescriptionListTerm>
                <DescriptionListDescription>
                  {isDestinationFetchLoading ? (
                    <Skeleton screenreaderText="Loading contents" />
                  ) : (
                    destination?.name
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>{t("type")}</DescriptionListTerm>
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
                <DescriptionListTerm>{t("description")}</DescriptionListTerm>
                <DescriptionListDescription>
                  {isDestinationFetchLoading ? (
                    <Skeleton screenreaderText="Loading contents" />
                  ) : (
                    destination?.description
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>{t("form.subHeading.title")}</DescriptionListTerm>
                <DescriptionListDescription>
                  <DescriptionList isCompact isHorizontal horizontalTermWidthModifier={{
                    default: '12ch',
                    sm: '15ch',
                    md: '20ch',
                    lg: '28ch',
                    xl: '30ch',
                    '2xl': '35ch'
                  }} aria-label="Compact horizontal">
                    {destination?.config && Object.keys(destination.config).map((key) => {
                      return (
                        <DescriptionListGroup key={key}>
                          <DescriptionListTerm>{key}</DescriptionListTerm>
                          <DescriptionListDescription>{destination.config[key]}</DescriptionListDescription>
                        </DescriptionListGroup>
                      )
                    })}

                  </DescriptionList>
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
