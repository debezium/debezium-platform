
import { Bullseye, Button, Content, ContentVariants, EmptyState, EmptyStateActions, EmptyStateBody, EmptyStateFooter, EmptyStateVariant, MenuToggle, MenuToggleElement, PageSection, SearchInput, Select, SelectList, SelectOption, ToggleGroup, ToggleGroupItem, Toolbar, ToolbarContent, ToolbarGroup, ToolbarItem } from "@patternfly/react-core";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { ThIcon, ListIcon, SearchIcon, FilterIcon } from "@patternfly/react-icons";
import { useState } from "react";
import { Catalog } from "src/apis";
import sourceCatalog from "../../__mocks__/data/SourceCatalog.json";
import destinationCatalog from "../../__mocks__/data/DestinationCatalog.json";
import _, { debounce } from "lodash";
import { useNavigate } from "react-router-dom";
import { ConnectionCatalogGrid } from "@components/ConnectionCatalogGrid";

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

  // Compute filtered and sorted results
  const searchResult = React.useMemo(() => {
    let catalogData: Catalog[] = [];
    
    if (connectionsTypeSelected === 'Source') {
      catalogData = sourceCatalog;
    } else if (connectionsTypeSelected === 'Destination') {
      catalogData = destinationCatalog;
    } else {
      catalogData = [...sourceCatalog, ...destinationCatalog];
    }

    // Apply search filter
    let filtered = catalogData;
    if (searchQuery.length > 0) {
      filtered = _.filter(catalogData, (o) => 
        o.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort by name
    return _.sortBy(filtered, (o) => o.name.toLowerCase());
  }, [connectionsTypeSelected, searchQuery]);

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

  const onConnectionSelection = (connectionId: string, role: string) => {

    navigate(`/connections/create_connection/${connectionId}`, { state: { connectionType: role } });
  };

  return (
    <>
      <PageSection isWidthLimited>
        <Content component="h1">{t("connection:catalog.title")}</Content>
        <Content component="p">
          {t("connection:catalog.description")}
        </Content>
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
                  placeholder={t("searchByName")}
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
                  {searchResult.length} {t("items")}
                </Content>
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </PageSection>
      {searchResult.length > 0 ? (
        <ConnectionCatalogGrid
          onCardSelect={onConnectionSelection}
          displayType={isSelected}
          searchResult={searchResult}
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