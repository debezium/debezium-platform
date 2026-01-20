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
  Tooltip,
} from "@patternfly/react-core";
import { CogIcon, ListIcon, ThIcon } from "@patternfly/react-icons";
import { useNavigate } from "react-router-dom";
import { CatalogGrid } from "@components/CatalogGrid";
import { useState } from "react";
import { debounce } from "lodash";
import _ from "lodash";
import sourceCatalog from "../../__mocks__/data/SourceCatalog.json";
import { useTranslation } from "react-i18next";

export interface ISinkProps {
  sampleProp?: string;
}

const SourceCatalog: React.FunctionComponent<ISinkProps> = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isSelected, setIsSelected] = React.useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Compute filtered results based on search query
  const searchResult = React.useMemo(() => {
    if (searchQuery.length === 0) {
      return sourceCatalog;
    }
    return _.filter(sourceCatalog, (o) =>
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
              <Tooltip
                content={
                  <div>
                    {t("smartEditorButtonTooltip", {val: "source"})}
                  </div>
                }
              >
                <Button variant="secondary" icon={<CogIcon />} onClick={() => onSourceSelection("")}>{t("smartEditorButton")}</Button>
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
