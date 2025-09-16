import * as React from "react";
import { Button, Card, Content, ContentVariants, EmptyState, MenuToggle, MenuToggleElement, PageSection, SearchInput, Select, SelectList, SelectOption, Spinner, ToggleGroup, Toolbar, ToolbarContent, ToolbarGroup, ToolbarItem } from "@patternfly/react-core";
import { PlusIcon } from "@patternfly/react-icons";
import EmptyStatus from "../../components/EmptyStatus";
import { useNavigate } from "react-router-dom";
import comingSoonImage from "../../assets/comingSoon.png";
import { useData } from "../../appLayout/AppContext";
import { featureFlags } from "@utils/featureFlag";
import { useTranslation } from "react-i18next";
import ApiError from "@components/ApiError";
import { Connection, fetchData } from "src/apis";
import { useQuery } from "react-query";
import { API_URL } from "@utils/constants";
import _, { debounce } from "lodash";
import PageHeader from "@components/PageHeader";
import { useCallback, useEffect, useState } from "react";
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
  const { darkMode } = useData();
  const connectionsType = ['All', 'Source', 'Destination'];

  const [connectionsTypeIsExpanded, setConnectionsTypeIsExpanded] = useState(false);
  const [connectionsTypeSelected, setConnectionsTypeSelected] = useState('');
  const [searchResult, setSearchResult] = useState<connectionsList[]>([]);
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
    data: connectionsList = [],
    error,
    isLoading: isConnectionsLoading,
  } = useQuery<Connection[], Error>(
    "connections",
    () => fetchData<Connection[]>(`${API_URL}/api/connections`),
    {
      refetchInterval: 7000,
      onSuccess: (data) => {
        // Persist filters across polling refreshes by deriving from latest data
        const withRole = data.map((conn) => ({
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

        setSearchResult(result);
      },
    }
  );

  useEffect(() => {
    // Derive list from latest data + current search/type filters
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

    setSearchResult(result);
  }, [connectionsTypeSelected, connectionsList, searchQuery]);

  const onClear = () => {
    onSearch?.("");
    setConnectionsTypeSelected('');
  };

  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      const withRole: connectionsList[] = connectionsList.map((conn) => ({
        ...conn,
        role: getConnectionRole(conn.type.toLowerCase()) || "",
      }));
      const filteredSource = _.filter(withRole, function (o: connectionsList) {
        return o.name.toLowerCase().includes(searchQuery.toLowerCase());
      });
      setSearchResult(filteredSource);
    }, 700),
    [connectionsList]
  );

  const onSearch = React.useCallback(
    (value: string) => {
      setSearchQuery(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
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
              titleText={t("loading")}
              headingLevel="h4"
              icon={Spinner}
            />
          ) : (
            <>
              {connectionsList.length > 0 ? (
                <>
                  <PageHeader
                    title={"Connection"}
                    description={"Lists the available connections. You can search a connection by its name or sort the list by source or destination type of connection."}
                  />

                  <PageSection>
                    <Card className="destination-card">
                      <Toolbar
                        id="toolbar-sticky"
                        className="custom-toolbar"
                        isSticky
                      >
                        <ToolbarContent>
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
                          <ToolbarItem variant="separator" />
                          <ToolbarItem>


                            <Select
                              toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                                <MenuToggle
                                  ref={toggleRef}
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
                        // tableType="destination"
                        onClear={onClear}
                      />
                    </Card>
                  </PageSection>
                </>
              ) : (
                <PageSection style={{ position: "relative", minHeight: "100%", overflow: "hidden" }} isFilled>
                  {!featureFlags.Connection && (
                    <div
                      className="transformation_overlay"
                      style={darkMode ? { background: "rgba(41, 41, 41, 0.6)" } : {}}
                    >
                      <img src={comingSoonImage} alt="Coming Soon" />
                    </div>
                  )}

                  <div className="vault_overlay">

                    <EmptyStatus
                      heading={"No Connection available"}
                      primaryMessage={"No connections is configured yet. Configure a one by selecting 'Add Connection' option below."}
                      secondaryMessage=""
                      primaryAction={
                        <Button variant="primary" icon={<PlusIcon />} onClick={() => navigateTo("/connections/catalog")}>
                          Add connection
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
