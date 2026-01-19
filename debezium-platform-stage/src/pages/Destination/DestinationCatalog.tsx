/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Button,
  Content,
  ContentVariants,
  PageSection,
  SearchInput,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  Tooltip,
} from "@patternfly/react-core";
import { CogIcon, ListIcon, ThIcon } from "@patternfly/react-icons";
import { useNavigate } from "react-router-dom";
import { CatalogGrid } from "@components/CatalogGrid";
import * as React from "react";
import { FunctionComponent, useState } from "react";
import destinationCatalog from "../../__mocks__/data/DestinationCatalog.json";
import { debounce } from "lodash";
import _ from "lodash";
import { useTranslation } from "react-i18next";

export interface ISinkProps {
  sampleProp?: string;
}

const DestinationCatalog: FunctionComponent<ISinkProps> = () => {
  const navigate = useNavigate();
  const [isSelected, setIsSelected] = useState<"list" | "grid">("grid");
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Compute filtered results based on search query
  const searchResult = React.useMemo(() => {
    if (searchQuery.length === 0) {
      return destinationCatalog;
    }
    return _.filter(destinationCatalog, (o) =>
      o.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const onClear = () => {
    onSearch?.("");
  };

  const handleItemClick = (
    event:
      | MouseEvent
      | React.MouseEvent<any, MouseEvent>
      | React.KeyboardEvent<Element>
  ) => {
    const id = event.currentTarget.id;
    setIsSelected(id.split("-")[2]);
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

  const onDestinationSelection = (destinationId: string) => {
    navigate(`/destination/create_destination/${destinationId}`);
  };

  return (
    <>
      <PageSection isWidthLimited>
        <Content component="h1">{t("destination:catalog.title")}</Content>
        <Content component="p">
          {t("destination:catalog.description")}
        </Content>
        <Toolbar
          id="toolbar-sticky"
          inset={{ default: "insetNone" }}
          className="custom-toolbar"
          isSticky
        >
          <ToolbarContent>
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
                  aria-label="grid"
                  buttonId="toggle-group-grid"
                  isSelected={isSelected === "grid"}
                  onChange={handleItemClick}
                />

                <ToggleGroupItem
                  icon={<ListIcon />}
                  aria-label="list"
                  buttonId="toggle-group-list"
                  isSelected={isSelected === "list"}
                  onChange={handleItemClick}
                />
              </ToggleGroup>
            </ToolbarItem>
            <ToolbarItem variant="separator" />
            <ToolbarItem>
              <Tooltip
                content={
                  <div>
                      {t("smartEditorButtonTooltip", {val: "destination"})}
                  </div>
                }
              >
                <Button variant="secondary" icon={<CogIcon />} onClick={() => onDestinationSelection("")}>{t("smartEditorButton")}</Button>
              </Tooltip>
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
      <CatalogGrid
        onCardSelect={onDestinationSelection}
        catalogType="destination"
        displayType={isSelected}
        isAddButtonVisible={searchQuery.length === 0}
        searchResult={searchResult}
      />
    </>
  );
};

export { DestinationCatalog };
