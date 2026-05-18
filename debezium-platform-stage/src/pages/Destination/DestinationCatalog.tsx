/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  Alert,
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
import { useTranslation } from "react-i18next";
import PageTour from "../../components/PageTour";
import { Step } from "react-joyride";
import { useQuery } from "react-query";
import { fetchData } from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { Catalog, CatalogApiResponse } from "../../apis/types";
import CatalogSkeleton from "@components/CatalogSkeleton";

const useDestinationCatalogTourSteps = (): Step[] => {
  const { t } = useTranslation("tour");
  return [
    {
      target: '[data-tour="destination-catalog-smart-editor"]',
      placement: "bottom",
      title: t("destinationCatalog.smartEditor.title"),
      content: t("destinationCatalog.smartEditor.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="catalog-grid"] .custom-gallery > :first-child',
      placement: "bottom",
      title: t("destinationCatalog.kafkaCard.title"),
      content: t("destinationCatalog.kafkaCard.content"),
      disableBeacon: true,
    },
  ];
};

export interface ISinkProps {
  sampleProp?: string;
}

const DestinationCatalog: React.FunctionComponent<ISinkProps> = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isSelected, setIsSelected] = React.useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const {
    data: destinationCatalog = [],
    error: catalogError,
    isLoading: isCatalogLoading,
    refetch,
  } = useQuery<Catalog[], Error>("destinationConnectorCatalog", async () => {
    const response = await fetchData<CatalogApiResponse>(
      `${API_URL}/api/catalog`
    );
    return (response.components["server-sink"] ?? []).map((entry) => ({
      ...entry,
      role: "destination",
    }));
  });

  const searchResult = React.useMemo(() => {
    if (searchQuery.length === 0) {
      return destinationCatalog;
    }
    return _.filter(destinationCatalog, (o) =>
      o.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, destinationCatalog]);

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
    const entry = destinationCatalog.find((c) => c.class === destinationId);
    navigate(`/destination/create_destination/${destinationId}`, {
      state: { descriptor: entry?.descriptor },
    });
  };

  const catalogTourSteps = useDestinationCatalogTourSteps();

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
            <ToolbarItem data-tour="destination-catalog-search">
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
                <Button variant="secondary" icon={<CogIcon />} data-tour="destination-catalog-smart-editor" onClick={() => onDestinationSelection("")}>{t("smartEditorButton")}</Button>
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

      {catalogError ? (
        <PageSection>
          <Alert
            variant="danger"
            title={t("destination:catalog.fetchError", "Failed to load destination catalog")}
            actionLinks={
              <Button variant="link" onClick={() => refetch()}>
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
      ) : (
        <CatalogGrid
          onCardSelect={onDestinationSelection}
          catalogType="destination"
          displayType={isSelected}
          isAddButtonVisible={searchQuery.length === 0}
          searchResult={searchResult}
        />
      )}
      <PageTour pageKey="destination-catalog" steps={catalogTourSteps} />
    </>
  );
};

export { DestinationCatalog };
