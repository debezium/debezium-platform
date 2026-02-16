import * as React from "react";
import {
  Button,
  Card,
  Content,
  ContentVariants,
  EmptyState,
  PageSection,
  SearchInput,
  Spinner,
  ToggleGroup,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import { DataSourceIcon, PlusIcon } from "@patternfly/react-icons";
import EmptyStatus from "../../components/EmptyStatus";
import { useNavigate } from "react-router-dom";
import { Source, fetchData } from "../../apis/apis";
import _, { debounce } from "lodash";
import { useQuery } from "react-query";
import { API_URL } from "../../utils/constants";
import SourceSinkTable from "../../components/SourceSinkTable";
import ApiError from "../../components/ApiError";
import "./Sources.css";
import PageHeader from "@components/PageHeader";
import { useTranslation } from "react-i18next";
import PageTour from "../../components/PageTour";
import { Step } from "react-joyride";

export interface ISourceProps {
  sampleProp?: string;
}

const useSourcePageTourSteps = (): Step[] => {
  const { t } = useTranslation("tour");
  return [
    {
      target: '[data-tour="source-page"]',
      placement: "center",
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

  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const {
    data: sourcesList = [],
    error,
    isLoading: isSourceLoading,
  } = useQuery<Source[], Error>(
    "sources",
    () => fetchData<Source[]>(`${API_URL}/api/sources`),
    {
      refetchInterval: 7000,
    }
  );

  // Compute filtered results based on search query
  const searchResult = React.useMemo(() => {
    if (searchQuery.length === 0) {
      return sourcesList;
    }
    return _.filter(sourcesList, (o) =>
      o.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, sourcesList]);

  const onClear = () => {
    onSearch?.("");
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
  return (
    <div data-tour="source-page" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
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
                          <ToolbarItem data-tour="source-search">
                            <SearchInput
                              aria-label="Items example search input"
                              placeholder={t('findByName')}
                              value={searchQuery}
                              onChange={(_event, value) => onSearch(value)}
                              onClear={onClear}
                            />
                          </ToolbarItem>
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
                                {searchResult.length} {t("items")}
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
                      <Button
                        variant="link"
                        onClick={() => navigateTo("/vaults")}
                      >
                        {t('vaults')}
                      </Button>
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
