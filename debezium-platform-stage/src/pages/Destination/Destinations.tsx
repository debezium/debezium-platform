import * as React from "react";
import {
  Button,
  Card,
  Content,
  ContentVariants,
  EmptyState,
  MenuToggle,
  MenuToggleElement,
  PageSection,
  SearchInput,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  ToggleGroup,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import { RhUiDataSinkIcon, FilterIcon, PlusIcon } from "@patternfly/react-icons";
import { useNavigate } from "react-router-dom";
import EmptyStatus from "../../components/EmptyStatus";
import { Destination, fetchData } from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import _, { debounce } from "lodash";
import { useResourceQuery } from "../../hooks/useResourceQuery";
import SourceSinkTable from "../../components/SourceSinkTable";
import ApiError from "../../components/ApiError";
import "./Destinations.css";
import PageHeader from "@components/PageHeader";
import { useTranslation } from "react-i18next";
import PageTour from "../../components/PageTour";
import { Step } from "react-joyride";
import { isRouteNavVisible } from "@utils/featureFlag";

const useDestinationPageTourSteps = (): Step[] => {
  const { t } = useTranslation("tour");
  return [
    {
      target: '[data-tour="destination-table"] tbody tr:first-child',
      placement: "bottom",
      title: t("destinationPage.welcome.title"),
      content: t("destinationPage.welcome.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="add-destination"]',
      placement: "bottom",
      title: t("destinationPage.addDestination.title"),
      content: t("destinationPage.addDestination.content"),
      disableBeacon: true,
    },
  ];
};

const Destinations: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const destinationPageTourSteps = useDestinationPageTourSteps();
  const navigateTo = (url: string) => {
    navigate(url);
  };

  type FilterField = "name" | "type";

  const FILTER_OPTIONS: { value: FilterField; label: string }[] = [
    { value: "name", label: "Name" },
    { value: "type", label: "Type" },
  ];

  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [filterField, setFilterField] = React.useState<FilterField>("name");
  const [isFilterSelectOpen, setIsFilterSelectOpen] = React.useState<boolean>(false);

  const {
    data: destinationsList = [],
    error,
    isLoading: isDestinationLoading,
  } = useResourceQuery<Destination[], Error>(
    "destinations",
    () => fetchData<Destination[]>(`${API_URL}/api/destinations`)
  );

  const searchResult = React.useMemo(() => {
    if (searchQuery.length === 0) {
      return destinationsList;
    }
    return _.filter(destinationsList, (o) =>
      o[filterField].toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, filterField, destinationsList]);

  const onClear = () => {
    onSearch?.("");
  };

  const onFilterFieldSelect = React.useCallback(
    (_event: React.MouseEvent<Element, MouseEvent> | undefined, value: string | number | undefined) => {
      setFilterField((value as FilterField) ?? "name");
      setIsFilterSelectOpen(false);
      onClear();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

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
    <div data-tour="destination-page" style={{ flex: 1, display: "flex", flexDirection: "column", maxHeight: "100%" }}>
      {error ? (
        <ApiError
          errorType="large"
          errorMsg={error.message}
          secondaryActions={
            <>
              <Button variant="link" onClick={() => navigateTo("/source")}>
                {t("goTo", { val: t("source:source") })}
              </Button>
              <Button variant="link" onClick={() => navigateTo("/pipeline")}>
                {t("goTo", { val: t("pipeline:pipeline") })}
              </Button>
            </>
          }
        />
      ) : (
        <>
          {isDestinationLoading ? (
            <EmptyState
              titleText={t("loading")}
              headingLevel="h4"
              icon={Spinner}
            />
          ) : (
            <>
              {destinationsList.length > 0 ? (
                <>
                  <PageHeader
                    title={t("destination")}
                    description={t("destination:page.description")}
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
                              <Select
                                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                                  <MenuToggle
                                    ref={toggleRef}
                                    icon={<FilterIcon />}
                                    onClick={() => setIsFilterSelectOpen((prev) => !prev)}
                                    isExpanded={isFilterSelectOpen}
                                    style={{ width: "120px" } as React.CSSProperties}
                                  >
                                    {FILTER_OPTIONS.find((o) => o.value === filterField)?.label ?? "Name"}
                                  </MenuToggle>
                                )}
                                onSelect={onFilterFieldSelect}
                                onOpenChange={setIsFilterSelectOpen}
                                selected={filterField}
                                isOpen={isFilterSelectOpen}
                              >
                                <SelectList>
                                  {FILTER_OPTIONS.map((option) => (
                                    <SelectOption key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectOption>
                                  ))}
                                </SelectList>
                              </Select>
                            </ToolbarItem>
                            <ToolbarItem>
                              <SearchInput
                                aria-label={`Search destinations by ${filterField}`}
                                placeholder={`Find by ${filterField}...`}
                                value={searchQuery}
                                onChange={(_event, value) => onSearch(value)}
                                onClear={onClear}
                              />
                            </ToolbarItem>
                          </ToolbarGroup>
                          <ToolbarItem>
                            <ToggleGroup aria-label="Icon variant toggle group">
                              <Button
                                variant="primary"
                                icon={<PlusIcon />}
                                data-tour="add-destination"
                                onClick={() =>
                                  navigateTo("/destination/catalog")
                                }
                              >
                                {t("addButton", {
                                  val: t("destination:destination"),
                                })}
                              </Button>
                            </ToggleGroup>
                          </ToolbarItem>
                          <ToolbarGroup align={{ default: "alignEnd" }}>
                            <ToolbarItem>
                              <Content component={ContentVariants.small}>
                                {searchQuery.length > 0
                                  ? `${searchResult.length} ${t("of")} ${destinationsList.length} ${t("items")}`
                                  : `${destinationsList.length} ${t("items")}`}
                              </Content>
                            </ToolbarItem>
                          </ToolbarGroup>
                        </ToolbarContent>
                      </Toolbar>
                      <div data-tour="destination-table">
                        <SourceSinkTable
                          data={searchResult}
                          tableType="destination"
                          onClear={onClear}
                        />
                      </div>
                    </Card>
                  </PageSection>
                </>
              ) : (
                <EmptyStatus
                  heading={t("emptyState.title", { val: t("destination:destination") })}
                  primaryMessage={t("emptyState.description", { val: t("destination:destination") })}
                  secondaryMessage=""
                  icon={RhUiDataSinkIcon as React.ComponentType<unknown>}
                  primaryAction={
                    <Button
                      variant="primary"
                      icon={<PlusIcon />}
                      data-tour="add-destination"
                      onClick={() => navigateTo("/destination/catalog")}
                    >
                      {t("addButton", {
                        val: t("destination:destination"),
                      })}
                    </Button>
                  }
                  secondaryActions={
                    <>
                      <Button
                        variant="link"
                        onClick={() => navigateTo("/source")}
                      >
                        {t("source")}
                      </Button>
                      <Button
                        variant="link"
                        onClick={() => navigateTo("/transform")}
                      >
                        {t("transform")}
                      </Button>
                      {isRouteNavVisible("Vault") && (
                        <Button
                          variant="link"
                          onClick={() => navigateTo("/vaults")}
                        >
                          {t("vaults")}
                        </Button>
                      )}
                    </>
                  }
                />
              )}
            </>
          )}
        </>
      )}
      <PageTour pageKey="destination" steps={destinationPageTourSteps} />
    </div>
  );
};

export { Destinations };
