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
import { DataSinkIcon, PlusIcon } from "@patternfly/react-icons";
import { useNavigate } from "react-router-dom";
import EmptyStatus from "../../components/EmptyStatus";
import { Destination, fetchData } from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import _, { debounce } from "lodash";
import { useQuery } from "react-query";
import SourceSinkTable from "../../components/SourceSinkTable";
import ApiError from "../../components/ApiError";
import "./Destinations.css";
import PageHeader from "@components/PageHeader";
import { useTranslation } from "react-i18next";
const Destinations: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const navigateTo = (url: string) => {
    navigate(url);
  };

  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const {
    data: destinationsList = [],
    error,
    isLoading: isDestinationLoading,
  } = useQuery<Destination[], Error>(
    "destinations",
    () => fetchData<Destination[]>(`${API_URL}/api/destinations`),
    {
      refetchInterval: 7000,
    }
  );

  // Compute filtered results based on search query
  const searchResult = React.useMemo(() => {
    if (searchQuery.length === 0) {
      return destinationsList;
    }
    return _.filter(destinationsList, (o) =>
      o.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, destinationsList]);

  const onClear = () => {
    onSearch?.("");
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

  return (
    <>
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
                          <ToolbarItem>
                            <SearchInput
                              aria-label="Items example search input"
                              value={searchQuery}
                              placeholder={t("findByName")}
                              onChange={(_event, value) => onSearch(value)}
                              onClear={onClear}
                            />
                          </ToolbarItem>
                          <ToolbarItem>
                            <ToggleGroup aria-label="Icon variant toggle group">
                              <Button
                                variant="primary"
                                icon={<PlusIcon />}
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
                                {searchResult.length} {t("items")}
                              </Content>
                            </ToolbarItem>
                          </ToolbarGroup>
                        </ToolbarContent>
                      </Toolbar>

                      <SourceSinkTable
                        data={searchResult}
                        tableType="destination"
                        onClear={onClear}
                      />
                    </Card>
                  </PageSection>
                </>
              ) : (
                <EmptyStatus
                  heading={t("emptyState.title", { val: t("destination:destination") })}
                  primaryMessage={t("emptyState.description", { val: t("destination:destination") })}
                  secondaryMessage=""
                  icon={DataSinkIcon as React.ComponentType<unknown>}
                  primaryAction={
                    <Button
                      variant="primary"
                      icon={<PlusIcon />}
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
                      <Button
                        variant="link"
                        onClick={() => navigateTo("/vaults")}
                      >
                        {t("vaults")}
                      </Button>
                    </>
                  }
                />
              )}
            </>
          )}
        </>
      )}
    </>
  );
};

export { Destinations };
