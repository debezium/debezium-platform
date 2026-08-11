import {
  Bullseye,
  Button,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateVariant,
  MenuToggle,
  MenuToggleElement,
  SearchInput,
  Select,
  SelectList,
  SelectOption,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  Tooltip,
} from "@patternfly/react-core";
import { DataProcessorIcon, FilterIcon, SearchIcon } from "@patternfly/react-icons";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pipeline,
  TransformApiResponse,
  TransformData,
  fetchData,
} from "../apis/apis";
import { API_URL } from "../utils/constants";
import { useResourceQuery } from "../hooks/useResourceQuery";
import { useTranslation } from "react-i18next";
import UsedIn from "./UsedIn";
import { debounce } from "lodash";
import {
  getConnectorFamily,
  isTransformCompatibleWithSource,
} from "../utils/transformCatalog";

type FilterField = "name" | "type";

const FILTER_OPTIONS: { value: FilterField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "type", label: "Type" },
];

interface ITransformSelectionListProps {
  data: TransformApiResponse;
  onSelection: (selection: TransformData[]) => void;
  sourceType?: string;
}

const TransformSelectionList: React.FunctionComponent<
  ITransformSelectionListProps
> = ({ data, onSelection, sourceType }) => {
  const { t } = useTranslation();

  const { data: pipelineList = [] } = useResourceQuery<Pipeline[], Error>(
    "pipelines",
    () => fetchData<Pipeline[]>(`${API_URL}/api/pipelines`)
  );

  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [filterField, setFilterField] = useState<FilterField>("name");
  const [isSelectOpen, setIsSelectOpen] = useState<boolean>(false);

  const debouncedSetSearchQuery = useMemo(
    () => debounce((value: string) => setDebouncedQuery(value), 300),
    []
  );

  useEffect(() => {
    return () => debouncedSetSearchQuery.cancel();
  }, [debouncedSetSearchQuery]);

  const onSearchChange = useCallback(
    (_event: React.FormEvent<HTMLInputElement>, value: string) => {
      setSearchInput(value);
      debouncedSetSearchQuery(value);
    },
    [debouncedSetSearchQuery]
  );

  const onSearchClear = useCallback(() => {
    setSearchInput("");
    setDebouncedQuery("");
  }, []);

  const onFilterSelect = useCallback(
    (_event: React.MouseEvent<Element, MouseEvent> | undefined, value: string | number | undefined) => {
      setFilterField((value as FilterField) ?? "name");
      setIsSelectOpen(false);
      // Clear search when switching fields so stale results don't persist
      setSearchInput("");
      setDebouncedQuery("");
    },
    []
  );

  const filteredData = useMemo(() => {
    if (!debouncedQuery) return data;
    const q = debouncedQuery.toLowerCase();
    return data.filter((instance) =>
      instance[filterField].toLowerCase().includes(q)
    );
  }, [data, debouncedQuery, filterField]);

  const selectedLabel =
    FILTER_OPTIONS.find((o) => o.value === filterField)?.label ?? "Name";

  if (data.length === 0) {
    return (
      <EmptyState
        headingLevel="h2"
        titleText={t("emptyState.title", { val: "Transform" })}
        icon={DataProcessorIcon}
        variant={EmptyStateVariant.lg}
      >
        <EmptyStateBody>
          {t("emptyState.shortDescription", { val: "Transform" })}
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <>
      <Toolbar id="transform-selection-toolbar" className="model-table_toolbar">
        <ToolbarContent>
          <ToolbarGroup variant="filter-group">
            <ToolbarItem>
              <Select
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle
                    ref={toggleRef}
                    icon={<FilterIcon />}
                    onClick={() => setIsSelectOpen((prev) => !prev)}
                    isExpanded={isSelectOpen}
                    style={{ width: "120px" } as React.CSSProperties}
                  >
                    {selectedLabel}
                  </MenuToggle>
                )}
                onSelect={onFilterSelect}
                onOpenChange={setIsSelectOpen}
                selected={filterField}
                isOpen={isSelectOpen}
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
                aria-label={`Search transforms by ${selectedLabel}`}
                placeholder={`Find by ${selectedLabel.toLowerCase()}...`}
                value={searchInput}
                onChange={onSearchChange}
                onClear={onSearchClear}
              />
            </ToolbarItem>
          </ToolbarGroup>
          <ToolbarGroup align={{ default: "alignEnd" }}>
            <ToolbarItem>
              <Content component={ContentVariants.small}>
                {debouncedQuery
                  ? `${filteredData.length} ${t("of")} ${data.length} ${t("items")}`
                  : `${data.length} ${t("items")}`}
              </Content>
            </ToolbarItem>
          </ToolbarGroup>
        </ToolbarContent>
      </Toolbar>

      <Table aria-label="transform table" variant="compact">
        <Thead>
          <Tr>
            <Th key={0}>{t("name")}</Th>
            <Th key={1}>{t("type")}</Th>
            <Th key={2}>{t("active")}</Th>
          </Tr>
        </Thead>
        <Tbody>
          {filteredData.length > 0 ? (
            filteredData.map((instance) => {
              const compatible = isTransformCompatibleWithSource(
                instance.type,
                sourceType
              );
              const family = getConnectorFamily(instance.type);
              return (
                <Tr
                  key={instance.id}
                  onRowClick={
                    compatible ? () => onSelection([instance]) : undefined
                  }
                  isSelectable={compatible}
                  isClickable={compatible}
                  style={
                    compatible
                      ? undefined
                      : { opacity: 0.55, cursor: "not-allowed" }
                  }
                >
                  <Td dataLabel={t("name")}>
                    {compatible ? (
                      instance.name
                    ) : (
                      <Tooltip
                        content={t(
                          "transform:transformModal.incompatibleWithSource",
                          { family: family ?? "connector" }
                        )}
                      >
                        <span>{instance.name}</span>
                      </Tooltip>
                    )}
                  </Td>
                  <Td dataLabel={t("type")} style={{ paddingLeft: "0px" }}>
                    {instance.type}
                  </Td>
                  <Td dataLabel={t("active")}>
                    <UsedIn
                      resourceList={pipelineList}
                      resourceType={"pipeline"}
                      requestedPageType={"transform"}
                      instance={instance}
                    />
                  </Td>
                </Tr>
              );
            })
          ) : (
            <Tr>
              <Td colSpan={3}>
                <Bullseye>
                  <EmptyState
                    headingLevel="h2"
                    titleText={t("search.title", { val: t("transform:transform") })}
                    icon={SearchIcon}
                    variant={EmptyStateVariant.sm}
                  >
                    <EmptyStateBody>
                      {t("search.description")}
                    </EmptyStateBody>
                    <EmptyStateFooter><Button variant="link" onClick={onSearchClear}>Clear search</Button></EmptyStateFooter>
                  </EmptyState>
                </Bullseye>
              </Td>
            </Tr>
          )}
        </Tbody>
      </Table>
    </>
  );
};

export default TransformSelectionList;
