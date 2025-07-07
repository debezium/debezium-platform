/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
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
} from "@patternfly/react-core";
import { CogIcon, ListIcon, ThIcon } from "@patternfly/react-icons";
import { useNavigate } from "react-router-dom";
import { CatalogGrid } from "@components/CatalogGrid";
import { useCallback, useState } from "react";
import { debounce } from "lodash";
import _ from "lodash";
import sourceCatalog from "../../__mocks__/data/SourceCatalog.json";
import { Catalog } from "src/apis/types";
import { useTranslation } from "react-i18next";

export interface ISinkProps {
  sampleProp?: string;
}

const SourceCatalog: React.FunctionComponent<ISinkProps> = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isSelected, setIsSelected] = React.useState<"grid" | "list">("grid");

  const [searchResult, setSearchResult] = useState<Catalog[]>(sourceCatalog);
  const [searchQuery, setSearchQuery] = useState<string>("");

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

  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      const filteredSource = _.filter(sourceCatalog, function (o) {
        return o.name.toLowerCase().includes(searchQuery.toLowerCase());
      });
      setSearchResult(filteredSource);
    }, 700),
    []
  );

  const onSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  const onSourceSelection = (sourceId: string) => {
    navigate(`/source/create_source/${sourceId}`);
  };

  return (
    <>
      <PageSection isWidthLimited>
        <Content component="h1">{t('source:catalog.title')}</Content>
        <Content component="p">
          {t('source:catalog.description')}
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
            <ToolbarItem variant="separator" />
            <ToolbarItem>
            <Button variant="secondary" icon={<CogIcon/>}>Use editor to create</Button>
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
        onCardSelect={onSourceSelection}
        catalogType="source"
        displayType={isSelected}
        isAddButtonVisible={searchQuery.length === 0}
        searchResult={searchResult}
      />
    </>
  );
};

export { SourceCatalog };
