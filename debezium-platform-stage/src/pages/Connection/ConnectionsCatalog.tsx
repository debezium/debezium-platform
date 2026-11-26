
import { Alert, Bullseye, Button, Content, ContentVariants, EmptyState, EmptyStateActions, EmptyStateBody, EmptyStateFooter, EmptyStateVariant, MenuToggle, MenuToggleElement, PageSection, SearchInput, Select, SelectList, SelectOption, ToggleGroup, ToggleGroupItem, Toolbar, ToolbarContent, ToolbarGroup, ToolbarItem } from "@patternfly/react-core";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { ThIcon, ListIcon, SearchIcon, FilterIcon } from "@patternfly/react-icons";
import { useState } from "react";
import { Catalog, CatalogApiResponse } from "src/apis/types";
import _, { debounce } from "lodash";
import { useNavigate } from "react-router-dom";
import { CatalogGrid } from "@components/CatalogGrid";
import CatalogSkeleton from "@components/CatalogSkeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "../../apis/apis";

import { PageHeader } from "@patternfly/react-component-groups";
import { catalogPath } from "../../apis/endpoints";

export interface IConnectionsCatalogProps {
  sampleProp?: string;
}

const ConnectionsCatalog: React.FunctionComponent<IConnectionsCatalogProps> = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const connectionsType = ['All', 'Source', 'Destination'];

  const [connectionsTypeIsExpanded, setConnectionsTypeIsExpanded] = useState(false);
  const [connectionsTypeSelected, setConnectionsTypeSelected] = useState('');
  const [isSelected, setIsSelected] = React.useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const {
    data: sourceCatalog = [],
    error: sourceCatalogError,
    isLoading: isSourceCatalogLoading,
    refetch: refetchSourceCatalog,
  } = useQuery<Catalog[], Error>({
    queryKey: ["sourceConnectorCatalog"],

    queryFn: async () => {
      const response = await fetchData<CatalogApiResponse>(
        catalogPath()
      );
      return (response.components["source-connector"] ?? []).map((entry) => ({
        ...entry,
        role: "source",
      }));
    }
  });

  const {
    data: destinationCatalog = [],
    error: destinationCatalogError,
    isLoading: isDestinationCatalogLoading,
    refetch: refetchDestinationCatalog,
  } = useQuery<Catalog[], Error>({
    queryKey: ["destinationConnectorCatalog"],

    queryFn: async () => {
      const response = await fetchData<CatalogApiResponse>(
        catalogPath()
      );
      return (response.components["server-sink"] ?? []).map((entry) => ({
        ...entry,
        role: "destination",
      }));
    }
  });

  const catalogError = sourceCatalogError ?? destinationCatalogError;
  const isCatalogLoading = isSourceCatalogLoading || isDestinationCatalogLoading;

  const refetchCatalog = () => {
    void refetchSourceCatalog();
    void refetchDestinationCatalog();
  };

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

  const searchResult = React.useMemo(() => {
    let catalogData: Catalog[] = [];

    if (connectionsTypeSelected === 'Source') {
      catalogData = sourceCatalog;
    } else if (connectionsTypeSelected === 'Destination') {
      catalogData = destinationCatalog;
    } else {
      catalogData = [...sourceCatalog, ...destinationCatalog];
    }

    let filtered = catalogData;
    if (searchQuery.length > 0) {
      filtered = _.filter(catalogData, (o) =>
        o.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return _.sortBy(filtered, (o) => o.name.toLowerCase());
  }, [connectionsTypeSelected, searchQuery, sourceCatalog, destinationCatalog]);

  const onClear = () => {
    onSearch?.("");
    setConnectionsTypeSelected('');
  };

  const handleItemClick = (
    event:
      React.MouseEvent | React.KeyboardEvent | MouseEvent
  ) => {
    const id = (event.currentTarget as HTMLElement).id;
    setIsSelected(id.split("-")[2] as "grid" | "list");
  };

  const debouncedSetSearchQuery = React.useMemo(
    () => debounce((value: string) => {
      setSearchQuery(value);
    }, 700),
    []
  );

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

  const onConnectionSelection = (connectionId: string, role?: string) => {
    if (role) {
      navigate(`/connections/create_connection/${connectionId}`, { state: { connectionType: role } });
    }
  };

  return (
    <>
      <PageHeader
        title={t("connection:catalog.title")}
        subtitle={t("connection:catalog.description")}
      />
      <PageSection isWidthLimited>
        <Toolbar
          id="toolbar-sticky"
          inset={{ default: "insetNone" }}
          className="custom-toolbar"
          isSticky
        >
          <ToolbarContent>
            <ToolbarGroup variant="filter-group">
              <ToolbarItem>
                <SearchInput
                  aria-label="Items  search input"
                  placeholder={t("findBy",{val: "name"})}
                  value={searchQuery}
                  onChange={(_event, value) => onSearch(value)}
                  onClear={onClear}
                />
              </ToolbarItem>
              <ToolbarItem>
                <ToggleGroup aria-label="Display variant toggle group">
                  <ToggleGroupItem
                    icon={<ThIcon />}
                    aria-label="Grid view"
                    buttonId="toggle-group-grid"
                    isSelected={isSelected === "grid"}
                    onChange={handleItemClick}
                  />

                  <ToggleGroupItem
                    icon={<ListIcon />}
                    aria-label="List view"
                    buttonId="toggle-group-list"
                    isSelected={isSelected === "list"}
                    onChange={handleItemClick}
                  />
                </ToggleGroup>
              </ToolbarItem>
            </ToolbarGroup>

            <ToolbarItem variant="separator" />
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

            <ToolbarGroup align={{ default: "alignEnd" }}>
              <ToolbarItem>
                <Content component={ContentVariants.small}>
                  {searchQuery.length > 0
                    ? `${searchResult.length} ${t("of")} ${sourceCatalog.length + destinationCatalog.length} ${t("items")}`
                    : `${searchResult.length} ${t("items")}`}
                </Content>
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </PageSection>
      {catalogError ? (
        <PageSection>
          <Alert
            variant="danger"
            title={t("connection:catalog.fetchError", "Failed to load connection catalog")}
            actionLinks={
              <Button variant="link" onClick={refetchCatalog}>
                {t("retry", "Retry")}
              </Button>
            }
          >
            {catalogError.message}
          </Alert>
        </PageSection>
      ) : isCatalogLoading ? (
        <PageSection>
          <CatalogSkeleton />
        </PageSection>
      ) : searchResult.length > 0 ? (
        <CatalogGrid
          onCardSelect={onConnectionSelection}
          catalogType="connection"
          displayType={isSelected}
          searchResult={searchResult}
          showSubtitle={true}
        />) : (

        <Bullseye>
          <EmptyState
            headingLevel="h2"
            titleText={t("connection:catalog.emptyStateTitle")}
            icon={SearchIcon}
            variant={EmptyStateVariant.sm}
          >
            <EmptyStateBody>{t("connection:catalog.emptyStateDescription")}</EmptyStateBody>
            <EmptyStateFooter>
              <EmptyStateActions>
                <Button variant="link" onClick={onClear}>
                  {t("search.clearAll")}
                </Button>
              </EmptyStateActions>
            </EmptyStateFooter>
          </EmptyState>
        </Bullseye>
      )}
    </>
  );
};

export { ConnectionsCatalog };
