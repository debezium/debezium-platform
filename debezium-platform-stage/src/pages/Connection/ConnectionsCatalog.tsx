
import { Bullseye, Button, Content, ContentVariants, EmptyState, EmptyStateActions, EmptyStateBody, EmptyStateFooter, EmptyStateVariant, MenuToggle, MenuToggleElement, PageSection, SearchInput, Select, SelectList, SelectOption, ToggleGroup, ToggleGroupItem, Toolbar, ToolbarContent, ToolbarGroup, ToolbarItem } from "@patternfly/react-core";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { ThIcon, ListIcon, SearchIcon, FilterIcon } from "@patternfly/react-icons";
import { useCallback, useEffect, useState } from "react";
import { Catalog, ConnectionsSchema, fetchData } from "src/apis";
import sourceCatalog from "../../__mocks__/data/SourceCatalog.json";
import destinationCatalog from "../../__mocks__/data/DestinationCatalog.json";
import _, { debounce } from "lodash";
import { useNavigate } from "react-router-dom";
import { ConnectionCatalogGrid } from "@components/ConnectionCatalogGrid";
import { useQuery } from "react-query";
import { API_URL } from "@utils/constants";

export interface IConnectionsCatalogProps {
  sampleProp?: string;
}

const ConnectionsCatalog: React.FunctionComponent<IConnectionsCatalogProps> = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const connectionsType = ['All', 'Source', 'Destination'];
  // const [isValidationChecked, setIsValidationChecked] = useState<boolean>(false);

  const [connectionsTypeIsExpanded, setConnectionsTypeIsExpanded] = useState(false);
  const [connectionsTypeSelected, setConnectionsTypeSelected] = useState('');
  const [isSelected, setIsSelected] = React.useState<"grid" | "list">("grid");



  const [searchResult, setSearchResult] = useState<Catalog[]>(
    _.sortBy([...sourceCatalog, ...destinationCatalog], (o) => o.name.toLowerCase())
  );
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

  useEffect(() => {
    if (connectionsTypeSelected === 'Source') {
      setSearchResult(sourceCatalog);
    } else if (connectionsTypeSelected === 'Destination') {
      setSearchResult(destinationCatalog);
    } else {
      setSearchResult(_.sortBy([...sourceCatalog, ...destinationCatalog], (o) => o.name.toLowerCase()));
    }

  }, [connectionsTypeSelected]);

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

  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      let filteredSource: Catalog[] = [];
      if (connectionsTypeSelected === 'Source') {
        filteredSource = _.filter(
          sourceCatalog,
          function (o) {
            return o.name.toLowerCase().includes(searchQuery.toLowerCase());
          }
        );

      } else if (connectionsTypeSelected === 'Destination') {
        filteredSource = _.filter(
          destinationCatalog,
          function (o) {
            return o.name.toLowerCase().includes(searchQuery.toLowerCase());
          }
        );
      } else {
        filteredSource = _.filter(
          [...sourceCatalog, ...destinationCatalog],
          function (o) {
            return o.name.toLowerCase().includes(searchQuery.toLowerCase());
          }
        );
      }

      const sortedFiltered = _.sortBy(filteredSource, (o) => o.name.toLowerCase());
      setSearchResult(sortedFiltered);
    }, 700),
    [connectionsTypeSelected]
  );

  const onSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  const onConnectionSelection = (connectionId: string, role: string) => {
    const connectionSchema = connectionsSchema.find((schema) => schema.type.toLowerCase() === connectionId.toLowerCase());

    navigate(`/connections/create_connection/${connectionId}`, { state: { connectionType: role, connectionSchema } });
  };

  const {
    data: connectionsSchema = [],
    error,
    isLoading: isSchemaLoading = true,
  } = useQuery<ConnectionsSchema[], Error>("connectionsSchema", () =>
    fetchData<ConnectionsSchema[]>(`${API_URL}/api/connections/schemas`)
  );

  // const handleChange = (_event: React.FormEvent<HTMLInputElement>, checked: boolean) => {
  //   setIsValidationChecked(checked);
  //   if (checked) {
  //     setSearchResult(searchResult.filter((item) => connectionsSchema.find((schema) => schema.type.toLowerCase() === item.id.toLowerCase())));
  //   } else {
  //     if (connectionsTypeSelected === 'Source') {
  //       setSearchResult(sourceCatalog);
  //     } else if (connectionsTypeSelected === 'Destination') {
  //       setSearchResult(destinationCatalog);
  //     } else {
  //       setSearchResult(_.sortBy([...sourceCatalog, ...destinationCatalog], (o) => o.name.toLowerCase()));
  //     }
  //   }
  // };

  return (
    <>
      <PageSection isWidthLimited>
        <Content component="h1">{"Connection catalog"}</Content>
        <Content component="p">
          {"Select a connection type from the catalog that you want to create. Connections that support validation are marked with a star icon. You can search by name and filter the list by source, destination, or validation support."}
        </Content>
        <Toolbar
          id="toolbar-sticky"
          inset={{ default: "insetNone" }}
          className="custom-toolbar"
          isSticky
        >
          <ToolbarContent>
            <ToolbarGroup variant="filter-group">
              {/* <ToolbarItem>


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

              </ToolbarItem> */}
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
          connectionsSchema={connectionsSchema}
          isSchemaLoading={isSchemaLoading}
          error={error}
        />) : (

        <Bullseye>
          <EmptyState
            headingLevel="h2"
            titleText={"No matching connection type is present"}
            icon={SearchIcon}
            variant={EmptyStateVariant.sm}
          >
            <EmptyStateBody>Clear all and try again.</EmptyStateBody>
            <EmptyStateFooter>
              <EmptyStateActions>
                <Button variant="link" onClick={onClear}>
                  Clear all
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