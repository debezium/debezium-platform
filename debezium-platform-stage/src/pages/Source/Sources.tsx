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
import { DataSourceIcon, FilterIcon, PlusIcon } from "@patternfly/react-icons";
import EmptyStatus from "../../components/EmptyStatus";
import { useNavigate } from "react-router-dom";
import { Source, fetchData } from "../../apis/apis";
import _, { debounce } from "lodash";
import { useResourceQuery } from "../../hooks/useResourceQuery";
import { API_URL } from "../../utils/constants";
import SourceSinkTable from "../../components/SourceSinkTable";
import ApiError from "../../components/ApiError";
import "./Sources.css";
import PageHeader from "@components/PageHeader";
import { useTranslation } from "react-i18next";
import PageTour from "../../components/PageTour";
import { Step } from "react-joyride";
import { isRouteNavVisible } from "@utils/featureFlag";

export interface ISourceProps {
  sampleProp?: string;
}

const useSourcePageTourSteps = (): Step[] => {
  const { t } = useTranslation("tour");
  return [
    {
      target: '[data-tour="source-table"] tbody tr:first-child',
      placement: "bottom",
      title: t("sourcePage.welcome.title"),
      content: t("sourcePage.welcome.content"),
      disableBeacon: true,
    },
    {
      target: '[data-tour="add-source"]',
      placement: "bottom",
      title: t("sourcePage.addSource.title"),
      content: t("sourcePage.addSource.content"),
      disableBeacon: true,
    },
  ];
};

const Sources: React.FunctionComponent<ISourceProps> = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const navigateTo = (url: string) => {
    navigate(url);
  };

  const sourcePageTourSteps = useSourcePageTourSteps();

  type FilterField = "name" | "type";

  const FILTER_OPTIONS: { value: FilterField; label: string }[] = [
    { value: "name", label: "Name" },
    { value: "type", label: "Type" },
  ];

  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [filterField, setFilterField] = React.useState<FilterField>("name");
  const [isFilterSelectOpen, setIsFilterSelectOpen] = React.useState<boolean>(false);

  const {
    data: sourcesList = [],
    error,
    isLoading: isSourceLoading,
  } = useResourceQuery<Source[], Error>(
    "sources",
    () => fetchData<Source[]>(`${API_URL}/api/sources`)
  );

  // Compute filtered results based on search query and filter field
  const searchResult = React.useMemo(() => {
    if (searchQuery.length === 0) {
      return sourcesList;
    }
    return _.filter(sourcesList, (o) =>
      o[filterField].toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, filterField, sourcesList]);

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
  return (
    <div data-tour="source-page" style={{ flex: 1, display: "flex", flexDirection: "column", maxHeight: "100%" }}>
      {error ? (
        <ApiError
          errorType="large"
          errorMsg={error.message}
          secondaryActions={
            <>
              <Button variant="link" onClick={() => navigateTo("/destination")}>
                Go to destination
              </Button>
              <Button variant="link" onClick={() => navigateTo("/pipeline")}>
                Go to pipeline
              </Button>
            </>
          }
        />
      ) : (
        <>
          {isSourceLoading ? (
            <EmptyState
              titleText="Loading..."
              headingLevel="h4"
              icon={Spinner}
            />
          ) : (
            <>
              {sourcesList.length > 0 ? (
                <>
                  <PageHeader
                    title={t('source')}
                    description={t('source:page.description')}
                  />
                  <PageSection>
                    <Card className="source-card">
                      <Toolbar
                        id="toolbar-sticky"
                        className="custom-toolbar"
                        isSticky
                      >
                        <ToolbarContent>
                          <ToolbarGroup variant="filter-group">
                            <ToolbarItem data-tour="source-search">
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
                                aria-label={`Search sources by ${filterField}`}
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
                                data-tour="add-source"
                                onClick={() => navigateTo("/source/catalog")}
                              >
                                {t('addButton', { val: t('source:source') })}
                              </Button>
                            </ToggleGroup>
                          </ToolbarItem>
                          <ToolbarGroup align={{ default: "alignEnd" }}>
                            <ToolbarItem>
                              <Content component={ContentVariants.small}>
                                {searchQuery.length > 0
                                  ? `${searchResult.length} ${t("of")} ${sourcesList.length} ${t("items")}`
                                  : `${sourcesList.length} ${t("items")}`}
                              </Content>
                            </ToolbarItem>
                          </ToolbarGroup>
                        </ToolbarContent>
                      </Toolbar>
                      <div data-tour="source-table">
                        <SourceSinkTable
                          data={searchResult}
                          tableType="source"
                          onClear={onClear}
                        />
                      </div>
                    </Card>
                  </PageSection>
                </>
              ) : (
                <EmptyStatus
                  heading={t('emptyState.title', { val: t('source:source') })}
                  primaryMessage={t('emptyState.description', { val: t('source:source') })}
                  secondaryMessage=""
                  icon={DataSourceIcon as React.ComponentType<unknown>}
                  primaryAction={
                    <Button
                      variant="primary"
                      icon={<PlusIcon />}
                      data-tour="add-source"
                      onClick={() => navigateTo("/source/catalog")}
                    >
                      {t('addButton', { val: t('source:source') })}
                    </Button>
                  }
                  secondaryActions={
                    <>
                      <Button
                        variant="link"
                        onClick={() => navigateTo("/connections")}
                      >
                        {t('connection')}
                      </Button>
                      <Button
                        variant="link"
                        onClick={() => navigateTo("/destination")}
                      >
                        {t('destination')}
                      </Button>
                      <Button
                        variant="link"
                        onClick={() => navigateTo("/transform")}
                      >
                        {t('transform')}
                      </Button>
                      {isRouteNavVisible("Vault") && (
                        <Button
                          variant="link"
                          onClick={() => navigateTo("/vaults")}
                        >
                          {t('vaults')}
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
      <PageTour pageKey="source" steps={sourcePageTourSteps} />
    </div>
  );
};

export { Sources };
