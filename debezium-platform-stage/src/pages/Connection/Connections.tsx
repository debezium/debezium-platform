import * as React from "react";
import { Button, Card, Content, ContentVariants, EmptyState, MenuToggle, MenuToggleElement, PageSection, SearchInput, Select, SelectList, SelectOption, Spinner, ToggleGroup, Toolbar, ToolbarContent, ToolbarGroup, ToolbarItem } from "@patternfly/react-core";
import { FilterIcon, PlusIcon } from "@patternfly/react-icons";
import EmptyStatus from "../../components/EmptyStatus";
import { useNavigate } from "react-router-dom";
// import { useData } from "../../appLayout/AppContext";
import { useTranslation } from "react-i18next";
import ApiError from "@components/ApiError";
import { Connection, Destination, fetchData, Source } from "src/apis";
import { useQuery } from "react-query";
import { API_URL } from "@utils/constants";
import _, { debounce } from "lodash";
import PageHeader from "@components/PageHeader";
import { useState } from "react";
import { getConnectionRole } from "@utils/helpers";
import ConnectionTable from "@components/ConnectionTable";


export interface IConnectionsProps {
  sampleProp?: string;
}
export interface connectionsList extends Connection {
  role: string;
}

const Connections: React.FunctionComponent<IConnectionsProps> = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const navigateTo = (url: string) => {
    navigate(url);
  };
  // const { darkMode } = useData();
  const connectionsType = ['All', 'Source', 'Destination'];

  const [connectionsTypeIsExpanded, setConnectionsTypeIsExpanded] = useState(false);
  const [connectionsTypeSelected, setConnectionsTypeSelected] = useState('');
  const [searchQuery, setSearchQuery] = useState<string>("");

  const onConnectionsTypeToggle = () => {
    setConnectionsTypeIsExpanded(!connectionsTypeIsExpanded);
  };

  const onConnectionsTypeSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    selection: string | number | undefined
  ) => {
    setConnectionsTypeSelected(selection ? String(selection) : "");
    setConnectionsTypeIsExpanded(false);
  };

  const {
    data: sourceList = [],
  } = useQuery<Source[], Error>(
    "sources",
    () => fetchData<Source[]>(`${API_URL}/api/sources`),
    {
      refetchInterval: 7000,
    }
  );

  const {
    data: destinationList = [],
  } = useQuery<Destination[], Error>(
    "destinations",
    () => fetchData<Destination[]>(`${API_URL}/api/destinations`),
    {
      refetchInterval: 7000,
    }
  );

  const {
    data: connectionsList = [],
    error,
    isLoading: isConnectionsLoading,
  } = useQuery<Connection[], Error>(
    "connections",
    () => fetchData<Connection[]>(`${API_URL}/api/connections`),
    {
      refetchInterval: 7000,
    }
  );

  // Compute filtered and sorted results
  const searchResult = React.useMemo(() => {
    const withRole = connectionsList.map((conn) => ({
      ...conn,
      role: getConnectionRole(conn.type.toLowerCase()) || "",
    }));

    let result = withRole;
    if (searchQuery.length > 0) {
      result = result.filter((o) =>
        o.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (connectionsTypeSelected === 'Source') {
      result = result.filter((conn) => conn.role === 'source');
    } else if (connectionsTypeSelected === 'Destination') {
      result = result.filter((conn) => conn.role === 'destination');
    } else {
      result = _.sortBy(result, (o) => o.name.toLowerCase());
    }

    return result;
  }, [connectionsTypeSelected, connectionsList, searchQuery]);

  const onClear = () => {
    onSearch?.("");
    setConnectionsTypeSelected('');
  };

  // Debounce the search query state update
  const debouncedSetSearchQuery = React.useMemo(
    () => debounce((value: string) => {
      setSearchQuery(value);
    }, 700),
    []
  );

  // Cleanup debounced function on unmount
  React.useEffect(() => {
    return () => {
      debouncedSetSearchQuery.cancel();
    };
  }, [debouncedSetSearchQuery]);

  const onSearch = React.useCallback(
    (value: string) => {
      debouncedSetSearchQuery(value);
    },
    [debouncedSetSearchQuery]
  );


  return (
    <>

      {error ? (
        <ApiError
          errorType="large"
          errorMsg={error.message}
          secondaryActions={
            <>
              <Button variant="link" onClick={() => navigateTo("/pipeline")}>
                {t("goTo", { val: t("pipeline:pipeline") })}
              </Button>
              <Button variant="link" onClick={() => navigateTo("/source")}>
                {t("goTo", { val: t("source:source") })}
              </Button>
              <Button variant="link" onClick={() => navigateTo("/destination")}>
                {t("goTo", { val: t("destination:destination") })}
              </Button>
            </>
          }
        />
      ) : (
        <>
          {isConnectionsLoading ? (
            <EmptyState
              titleText={t("Loading...")}
              headingLevel="h4"
              icon={Spinner}
            />
          ) : (
            <>
              {connectionsList.length > 0 ? (
                <>
                  <PageHeader
                    title={"Connection"}
                    description={"Lists the available connections. You can search a connection by its name or sort the list by source or destination connection type."}
                  />
                  <PageSection>
                    <Card className="destination-card">
                      <Toolbar
                        id="toolbar-sticky"
                        className="custom-toolbar"
                        isSticky
                      >
                        <ToolbarContent>
                          <ToolbarGroup variant="filter-group">
                            <ToolbarItem>
                              <SearchInput
                                aria-label="Items example search input"
                                value={searchQuery}
                                placeholder={t("findByName")}
                                onChange={(_event, value) => onSearch(value)}
                                onClear={onClear}
                              />
                            </ToolbarItem>
                            <ToolbarItem>
                              <Select
                                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                                  <MenuToggle
                                    ref={toggleRef}
                                    icon={<FilterIcon />}
                                    onClick={() => onConnectionsTypeToggle()}
                                    isExpanded={connectionsTypeIsExpanded}
                                    style={
                                      {
                                        width: '150px'
                                      } as React.CSSProperties
                                    }
                                  >
                                    {connectionsTypeSelected || 'Type'}
                                  </MenuToggle>
                                )}
                                onSelect={onConnectionsTypeSelect}
                                onOpenChange={(isOpen) => setConnectionsTypeIsExpanded(isOpen)}
                                selected={connectionsTypeSelected}
                                isOpen={connectionsTypeIsExpanded}
                              >
                                <SelectList>
                                  {connectionsType.map((option, index) => (
                                    <SelectOption key={index} value={option}>
                                      {option}
                                    </SelectOption>
                                  ))}
                                </SelectList>
                              </Select>

                            </ToolbarItem>
                          </ToolbarGroup>
                          <ToolbarItem>
                            <ToggleGroup aria-label="Icon variant toggle group">
                              <Button
                                variant="primary"
                                icon={<PlusIcon />}
                                onClick={() =>
                                  navigateTo("/connections/catalog")
                                }
                              >
                                {t("addButton", {
                                  val: "connection",
                                })}
                              </Button>
                            </ToggleGroup>
                          </ToolbarItem>

                          <ToolbarGroup align={{ default: "alignEnd" }}>
                            <ToolbarItem>
                              <Content component={ContentVariants.small}>
                                {searchResult.length} {" "}
                                {t("items")}
                              </Content>
                            </ToolbarItem>
                          </ToolbarGroup>
                        </ToolbarContent>
                      </Toolbar>

                      <ConnectionTable
                        data={searchResult}
                        sourceList={sourceList}
                        destinationList={destinationList}
                        onClear={onClear}
                      />
                    </Card>
                  </PageSection>
                </>
              ) : (
                <PageSection style={{ position: "relative", minHeight: "100%", overflow: "hidden" }} isFilled>

                  <div className="vault_overlay">

                    <EmptyStatus
                      heading={t("connection:page.emptyStateTitle")}
                      primaryMessage={t("connection:page.emptyStateDescription")}
                      secondaryMessage=""
                      primaryAction={
                        <Button variant="primary" icon={<PlusIcon />} onClick={() => navigateTo("/connections/catalog")}>
                          {t("addButton", { val: t("connection:connection") })}
                        </Button>
                      }
                      secondaryActions={
                        <>
                          <Button variant="link" onClick={() => navigateTo("/pipeline")}>
                            {t("pipeline")}
                          </Button>
                          <Button variant="link" onClick={() => navigateTo("/source")}>
                            {t("source")}
                          </Button>
                          <Button variant="link" onClick={() => navigateTo("/destination")}>
                            {t("destination")}
                          </Button>

                        </>
                      }
                    />

                  </div>
                </PageSection>
              )}
            </>
          )}
        </>
      )}
    </>
  );
};

export { Connections };
