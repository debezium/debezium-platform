import {
    Bullseye,
    Button,
    EmptyState,
    EmptyStateActions,
    EmptyStateBody,
    EmptyStateFooter,
    EmptyStateVariant,
    Label,
    Popover,
    Tooltip,
    TreeViewSearch,
} from "@patternfly/react-core";
import { AngleRightIcon, DatabaseIcon, SearchIcon, ServerGroupIcon } from "@patternfly/react-icons";
import { FC, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { TableData } from "src/apis";
import "./TableViewComponent.css";
import { useTranslation } from "react-i18next";
import { SelectedDataListItem } from "../apis/types";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ExplorerBinding, LEGACY_EXPLORER_BINDING } from "@utils/Datatype";
import {
    ExplorerNode,
    buildExplorerTree,
    extractExplorerSelections,
    selectionsEqual,
} from "@utils/explorerTree";

export const ROW_HEIGHT = 36;
export const EXPAND_ALL_MAX_TABLES = 500;

type TableViewComponentProps = {
    collections: TableData | undefined;
    setSelectedDataListItems: (dataListItems: SelectedDataListItem | undefined) => void;
    selectedDataListItems: SelectedDataListItem | undefined;
    /** Which tree levels write which catalog include-list properties. */
    binding?: ExplorerBinding;
    readOnly?: boolean;
};

type FlatItem = {
    item: ExplorerNode;
    depth: number;
    hasChildren: boolean;
};

type SchemaSelectionGroup = {
    name: string;
    fullyIncluded: boolean;
    selected: number;
    total: number;
};

function nodeMatchesSelection(node: ExplorerNode, selection: SelectedDataListItem | undefined): boolean {
    if (!selection) return false;
    const valueList = node.propertyName ? selection.values?.[node.propertyName] : undefined;
    const hasValueKey = node.propertyName != null && selection.values != null && node.propertyName in selection.values;

    if (node.level === "collection") {
        const fullyQualifiedName = node.fullyQualifiedName || node.selectionValue;
        if (hasValueKey) return !!valueList?.includes(fullyQualifiedName);
        return selection.tables.includes(fullyQualifiedName);
    }
    if (hasValueKey) return !!valueList?.includes(node.selectionValue);
    return selection.schemas.includes(node.selectionValue);
}

function collectMatchingNodes(nodes: ExplorerNode[], selection: SelectedDataListItem | undefined): ExplorerNode[] {
    const chosen: ExplorerNode[] = [];
    const seen = new Set<string>();
    const addTree = (node: ExplorerNode) => {
        if (seen.has(node.id)) return;
        seen.add(node.id);
        chosen.push(node);
        node.children?.forEach(addTree);
    };
    const walk = (items: ExplorerNode[]) => {
        for (const node of items) {
            if (nodeMatchesSelection(node, selection)) addTree(node);
            else if (node.children) walk(node.children);
        }
    };
    walk(nodes);
    return chosen;
}

function collectBranchIds(nodes: ExplorerNode[]): string[] {
    const ids: string[] = [];
    const walk = (items: ExplorerNode[]) => {
        for (const item of items) {
            if (item.children?.length) {
                ids.push(item.id);
                walk(item.children);
            }
        }
    };
    walk(nodes);
    return ids;
}

function tableCount(items: ExplorerNode[]): number {
    let count = 0;
    const walk = (nodes: ExplorerNode[]) => {
        for (const node of nodes) {
            if (node.level === "collection") count += 1;
            else if (node.children?.length) walk(node.children);
        }
    };
    walk(items);
    return count;
}

function formatSchemaCount(selected: number, total: number, language: string): string {
    return `(${selected.toLocaleString(language)}/${total.toLocaleString(language)})`;
}

/** Index of the schema row to pin, or null when the active schema header is already at the top. */
export function pinnedSchemaIndex(
    visibleItems: readonly { depth: number }[],
    scrollOffset: number,
    rowHeight: number,
): number | null {
    if (scrollOffset <= 0 || rowHeight <= 0 || visibleItems.length === 0) {
        return null;
    }

    let pinned: number | null = null;
    for (let index = 0; index < visibleItems.length; index++) {
        if (visibleItems[index].depth !== 0) {
            continue;
        }
        if (index * rowHeight < scrollOffset) {
            pinned = index;
        } else {
            break;
        }
    }
    if (pinned == null) {
        return null;
    }

    let nextSchema = visibleItems.length;
    for (let index = pinned + 1; index < visibleItems.length; index++) {
        if (visibleItems[index].depth === 0) {
            nextSchema = index;
            break;
        }
    }
    if (scrollOffset >= nextSchema * rowHeight) {
        return null;
    }
    return pinned;
}

function groupedCountPhrase(phrase: string, count: number, language: string): string {
    const formatted = count.toLocaleString(language);
    const raw = String(count);
    return formatted === raw ? phrase : phrase.replace(raw, formatted);
}

function collectionTotal(node: ExplorerNode): number {
    if (node.level === "collection") return 1;
    return (node.children ?? []).reduce((sum, child) => sum + collectionTotal(child), 0);
}

function selectedCollectionCount(node: ExplorerNode, tables: ReadonlySet<string>): number {
    if (node.level === "collection") {
        const fullyQualifiedName = node.fullyQualifiedName || node.selectionValue;
        return tables.has(fullyQualifiedName) ? 1 : 0;
    }
    return (node.children ?? []).reduce((sum, child) => sum + selectedCollectionCount(child, tables), 0);
}

function buildSelectionGroups(
    selection: SelectedDataListItem,
    roots: readonly ExplorerNode[],
): SchemaSelectionGroup[] {
    const included = new Set(selection.schemas);
    const tables = new Set(selection.tables);
    const groups: SchemaSelectionGroup[] = [];

    const walk = (node: ExplorerNode) => {
        if (node.level === "collection") return;
        if (node.propertyName && included.has(node.selectionValue)) {
            const total = collectionTotal(node);
            groups.push({ name: node.name, fullyIncluded: true, selected: total, total });
            return;
        }
        const children = node.children ?? [];
        const directCollections = children.length > 0 && children.every((child) => child.level === "collection");
        if (directCollections) {
            const selected = selectedCollectionCount(node, tables);
            if (selected > 0) {
                groups.push({
                    name: node.name,
                    fullyIncluded: false,
                    selected,
                    total: children.length,
                });
            }
            return;
        }
        children.forEach(walk);
    };

    roots.forEach(walk);
    return groups;
}

function schemaCountLabel(group: SchemaSelectionGroup, language: string): string {
    const formattedSelected = group.selected.toLocaleString(language);
    if (!group.fullyIncluded) {
        return formattedSelected;
    }
    return `${formattedSelected}/${group.total.toLocaleString(language)}`;
}

const SelectionSchemaList: FC<{ groups: SchemaSelectionGroup[] }> = ({ groups }) => {
    const { i18n } = useTranslation();

    return (
        <ul className="virtual-tree__summary-list">
            {groups.map((group) => (
                <li key={group.name} className="virtual-tree__summary-schema">
                    <span className="virtual-tree__summary-schema-name">{group.name}</span>
                    <span className="virtual-tree__summary-schema-count">
                        {schemaCountLabel(group, i18n.language)}
                    </span>
                </li>
            ))}
        </ul>
    );
};

const SelectionListPopover: FC<{ groups: SchemaSelectionGroup[] }> = ({ groups }) => {
    const { t } = useTranslation();
    const [opened, setOpened] = useState(false);
    const label = t("tableExplorer.viewSelection");

    return (
        <Popover
            aria-label={label}
            maxWidth="24rem"
            bodyContent={opened ? <SelectionSchemaList groups={groups} /> : <span />}
        >
            <Button
                variant="link"
                isInline
                type="button"
                className="virtual-tree__summary-action"
                onClick={() => setOpened(true)}
            >
                {label}
            </Button>
        </Popover>
    );
};

const TreeCheckbox: FC<{
    checked: boolean | null | undefined;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    ariaLabel?: string;
    disabled?: boolean;
}> = ({ checked, onChange, ariaLabel, disabled }) => {
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.indeterminate = checked === null;
        }
    }, [checked]);

    return (
        <input
            ref={ref}
            type="checkbox"
            checked={checked === true}
            onChange={onChange}
            aria-label={ariaLabel}
            className="virtual-tree__checkbox"
            disabled={disabled}
        />
    );
};

const TreeRow: FC<{
    item: ExplorerNode;
    depth: number;
    hasChildren: boolean;
    expanded: boolean;
    readOnly?: boolean;
    countLabel?: string;
    onToggle: (id: string) => void;
    onCheck: (event: React.ChangeEvent, item: ExplorerNode) => void;
}> = ({ item, depth, hasChildren, expanded, readOnly, countLabel, onToggle, onCheck }) => (
    <div
        className="virtual-tree__row-content"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
    >
        {hasChildren ? (
            <button
                type="button"
                className={`virtual-tree__toggle ${expanded ? "virtual-tree__toggle--expanded" : ""}`}
                onClick={() => onToggle(item.id)}
                aria-label={expanded ? "Collapse" : "Expand"}
                disabled={readOnly}
            >
                <AngleRightIcon />
            </button>
        ) : (
            <span className="virtual-tree__toggle-spacer" />
        )}
        <TreeCheckbox
            checked={item.checkProps?.checked}
            onChange={(event) => onCheck(event, item)}
            ariaLabel={`Select ${item.name}`}
            disabled={readOnly}
        />
        <span className="virtual-tree__icon">
            {item.level === "collection" ? <ServerGroupIcon /> : <DatabaseIcon />}
        </span>
        <span className="virtual-tree__name">{item.name}</span>
        {countLabel ? (
            <span className="virtual-tree__count">{countLabel}</span>
        ) : null}
    </div>
);

const TableViewComponent: FC<TableViewComponentProps> = ({
    collections,
    setSelectedDataListItems,
    selectedDataListItems,
    binding = LEGACY_EXPLORER_BINDING,
    readOnly,
}) => {
    const { t, i18n } = useTranslation();
    const [allExpanded, setAllExpanded] = useState(false);
    const [filteredItems, setFilteredItems] = useState<ExplorerNode[]>([]);
    const [isFiltered, setIsFiltered] = useState(false);
    const [options, setOptions] = useState<ExplorerNode[]>([]);
    const [checkedItems, setCheckedItems] = useState<ExplorerNode[]>([]);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [searchValue, setSearchValue] = useState("");
    const [collapsedDuringSearch, setCollapsedDuringSearch] = useState<Set<string>>(new Set());

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isInitializedRef = useRef(false);
    const prevSelectionRef = useRef<{ selectedDataListItems: SelectedDataListItem | undefined; options: ExplorerNode[] }>({
        selectedDataListItems: undefined,
        options: []
    });
    const prevCollectionsRef = useRef<TableData | undefined>(undefined);
    const prevBindingRef = useRef<ExplorerBinding | undefined>(undefined);
    const descendantChecked = useMemo(() => {
        const checkedIds = new Set(checkedItems.map((item) => item.id));
        const allChecked = new Map<ExplorerNode["id"], boolean>();
        const someChecked = new Map<ExplorerNode["id"], boolean>();
        const schemaCounts = new Map<string, string>();
        const visit = (item: ExplorerNode) => {
            if (!item.children?.length) {
                const checked = checkedIds.has(item.id);
                allChecked.set(item.id, checked);
                someChecked.set(item.id, checked);
                return;
            }
            let selectedChildren = 0;
            for (const child of item.children) {
                visit(child);
                if (checkedIds.has(child.id)) {
                    selectedChildren += 1;
                }
            }
            allChecked.set(item.id, item.children.every((child) => allChecked.get(child.id)));
            someChecked.set(item.id, item.children.some((child) => someChecked.get(child.id)));
            schemaCounts.set(item.id, formatSchemaCount(selectedChildren, item.children.length, i18n.language));
        };
        for (const item of options) {
            visit(item);
        }
        return { allChecked, someChecked, schemaCounts };
    }, [options, checkedItems, i18n.language]);

    useEffect(() => {
        if (options.length === 0) return;
        const prev = prevSelectionRef.current;
        if (selectionsEqual(prev.selectedDataListItems, selectedDataListItems) && prev.options === options) {
            return;
        }
        prevSelectionRef.current = { selectedDataListItems, options };

        queueMicrotask(() => {
            const hasSelection =
                !!selectedDataListItems &&
                (selectedDataListItems.schemas.length > 0 ||
                    selectedDataListItems.tables.length > 0 ||
                    Object.values(selectedDataListItems.values ?? {}).some((parts) => parts.length > 0));

            if (!hasSelection) {
                setCheckedItems((prevChecked) => (prevChecked.length === 0 ? prevChecked : []));
                isInitializedRef.current = true;
                return;
            }

            setCheckedItems(collectMatchingNodes(options, selectedDataListItems));
            isInitializedRef.current = true;
        });
    }, [selectedDataListItems, options]);

    useEffect(() => {
        if (!isInitializedRef.current || readOnly) return;

        const selections = extractExplorerSelections(options, new Set(checkedItems.map((item) => item.id)));
        if (selectionsEqual(selectedDataListItems, selections)) {
            return;
        }
        setSelectedDataListItems(selections);
    }, [checkedItems, setSelectedDataListItems, readOnly, selectedDataListItems, options]);

    useEffect(() => {
        if (prevCollectionsRef.current === collections && prevBindingRef.current === binding) {
            return;
        }
        prevCollectionsRef.current = collections;
        prevBindingRef.current = binding;
        queueMicrotask(() => {
            const newOptions = buildExplorerTree(collections, binding);
            setOptions(newOptions);
            setFilteredItems(newOptions);
            setIsFiltered(false);
            setSearchValue("");
            setCollapsedDuringSearch(new Set());
        });
    }, [collections, binding]);

    useEffect(() => {
        if (!readOnly || options.length === 0) return;
        setAllExpanded(true);
    }, [readOnly, options]);

    const onCheck = (event: React.ChangeEvent, treeViewItem: ExplorerNode) => {
        if (readOnly) return;
        const checked = (event.target as HTMLInputElement).checked;
        const checkedItemTree = options
            .map((opt) => Object.assign({}, opt))
            .filter((item) => filterItemsForCheck(item, treeViewItem));
        const flatCheckedItems = flattenTree(checkedItemTree);
        const visibleIds = isFiltered
            ? new Set(flattenTree(filteredItems).map((item) => item.id))
            : undefined;
        const itemsToToggle = checked && visibleIds
            ? flatCheckedItems.filter((item) => visibleIds.has(item.id))
            : flatCheckedItems;
        const toggleIds = new Set(itemsToToggle.map((item) => item.id));

        setCheckedItems((prevCheckedItems) => {
            if (checked) {
                const prevIds = new Set(prevCheckedItems.map((item) => item.id));
                const additions = itemsToToggle.filter((item) => !prevIds.has(item.id));
                return additions.length === 0 ? prevCheckedItems : prevCheckedItems.concat(additions);
            }
            const next = prevCheckedItems.filter((item) => !toggleIds.has(item.id));
            return next.length === prevCheckedItems.length ? prevCheckedItems : next;
        });
    };

    const updateSearch = (input: string) => {
        setSearchValue(input);
        setCollapsedDuringSearch(new Set());
        if (input === "") {
            setFilteredItems(options);
            setIsFiltered(false);
        } else {
            const filtered = options.map((opt) => Object.assign({}, opt)).filter((item) => filterItemsForSearch(item, input));
            setFilteredItems(filtered);
            setIsFiltered(true);
        }
        scrollContainerRef.current?.scrollTo?.({ top: 0 });
    };

    const onSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
        updateSearch(event.target.value);
    };

    const flattenTree = (tree: ExplorerNode[]) => {
        let result: ExplorerNode[] = [];
        tree.forEach((item) => {
            result.push(item);
            if (item.children) {
                result = result.concat(flattenTree(item.children));
            }
        });
        return result;
    };

    const mapTree = (item: ExplorerNode): ExplorerNode => {
        const hasCheck = descendantChecked.allChecked.get(item.id);
        if (item.checkProps) {
            item.checkProps.checked = false;

            if (hasCheck) {
                item.checkProps.checked = true;
            } else {
                const hasPartialCheck = descendantChecked.someChecked.get(item.id);
                if (hasPartialCheck) {
                    item.checkProps.checked = null;
                }
            }

            if (item.children) {
                return {
                    ...item,
                    children: item.children.map((child) => mapTree(child))
                };
            }
        }
        return item;
    };

    const filterItemsForCheck = (item: ExplorerNode, checkedItem: ExplorerNode): boolean => {
        if (item.id === checkedItem.id) {
            return true;
        }

        if (item.children) {
            return (
                (item.children = item.children
                    .map((opt) => Object.assign({}, opt))
                    .filter((child) => filterItemsForCheck(child, checkedItem))).length > 0
            );
        }
        return false;
    };

    const filterItemsForSearch = (item: ExplorerNode, input: string): boolean => {
        const itemName = typeof item.name === "string" ? item.name : String(item.name || "");
        if (itemName.toLowerCase().includes(input.toLowerCase())) {
            return true;
        }
        if (item.children) {
            return (
                (item.children = item.children
                    .map((opt: ExplorerNode) => Object.assign({}, opt))
                    .filter((child: ExplorerNode) => filterItemsForSearch(child, input))).length > 0
            );
        }
        return false;
    };

    const mappedFilteredItems = filteredItems.map((item) => mapTree(item));
    const selection = useMemo(
        () => extractExplorerSelections(options, new Set(checkedItems.map((item) => item.id))),
        [checkedItems, options],
    );
    const groups = useMemo(
        () => buildSelectionGroups(selection, options),
        [selection, options],
    );
    const hasSelection = selection.schemas.length > 0 || selection.tables.length > 0;
    const schemaLabel = selection.schemas.length > 0
        ? groupedCountPhrase(
            t("tableExplorer.schemaCount", { count: selection.schemas.length }),
            selection.schemas.length,
            i18n.language,
        )
        : null;
    const tableLabel = selection.tables.length > 0
        ? groupedCountPhrase(
            t("tableExplorer.tableCount", { count: selection.tables.length }),
            selection.tables.length,
            i18n.language,
        )
        : null;

    // Expand/collapse handlers. Search uses its own collapsed set so clearing
    // the query restores the unfiltered tree instead of expanding the catalog.
    const isNodeExpanded = useCallback(
        (id: string) => isFiltered ? !collapsedDuringSearch.has(id) : allExpanded || expandedIds.has(id),
        [allExpanded, isFiltered, expandedIds, collapsedDuringSearch]
    );

    const onToggleNode = useCallback((id: string) => {
        if (readOnly) return;
        if (isFiltered) {
            setCollapsedDuringSearch((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
            return;
        }
        if (allExpanded) {
            const allIds = new Set(collectBranchIds(options));
            allIds.delete(id);
            setExpandedIds(allIds);
            setAllExpanded(false);
        } else {
            setExpandedIds(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
        }
    }, [allExpanded, isFiltered, options, readOnly]);

    const filteredBranchIds = collectBranchIds(filteredItems);
    const showCollapseAll = isFiltered
        ? filteredBranchIds.length > 0 && filteredBranchIds.every((id) => !collapsedDuringSearch.has(id))
        : allExpanded;
    const tablesToExpand = isFiltered ? tableCount(filteredItems) : tableCount(options);
    const expandAllDisabled = !showCollapseAll && tablesToExpand > EXPAND_ALL_MAX_TABLES;

    const onToggleAll = () => {
        if (readOnly) return;
        if (isFiltered) {
            const branchIds = collectBranchIds(filteredItems);
            const anyExpanded = branchIds.some((id) => !collapsedDuringSearch.has(id));
            if (anyExpanded) {
                setCollapsedDuringSearch(new Set(branchIds));
            } else if (tableCount(filteredItems) <= EXPAND_ALL_MAX_TABLES) {
                setCollapsedDuringSearch(new Set());
            }
            return;
        }
        if (allExpanded) {
            setExpandedIds(new Set());
            setAllExpanded(false);
        } else if (tableCount(options) <= EXPAND_ALL_MAX_TABLES) {
            setAllExpanded(true);
        }
    };

    const visibleItems = useMemo((): FlatItem[] => {
        const result: FlatItem[] = [];
        const walk = (items: ExplorerNode[], depth: number) => {
            for (const item of items) {
                const hasChildren = !!item.children?.length;
                result.push({ item, depth, hasChildren });
                if (hasChildren && isNodeExpanded(item.id) && item.children) {
                    walk(item.children, depth + 1);
                }
            }
        };
        walk(mappedFilteredItems, 0);
        return result;
    }, [mappedFilteredItems, isNodeExpanded]);

    const virtualizer = useVirtualizer({
        count: visibleItems.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 20,
    });

    const scrollOffset = virtualizer.scrollOffset ?? 0;
    const pinnedIndex = pinnedSchemaIndex(visibleItems, scrollOffset, ROW_HEIGHT);
    const pinnedItem = pinnedIndex == null ? null : visibleItems[pinnedIndex];

    const matchSchemaCount = filteredItems.length;
    const matchTableCount = tableCount(filteredItems);
    const resultsLabel = t("tableExplorer.results", {
        tables: t("tableExplorer.tableCount", { count: matchTableCount }),
        schemas: t("tableExplorer.schemaCount", { count: matchSchemaCount }),
    });

    const expandAllButton = (
        <Button variant="link" onClick={onToggleAll} isDisabled={expandAllDisabled}>
            {showCollapseAll ? t("collapseAll") : t("expandAll")}
        </Button>
    );

    const toolbar = readOnly ? null : (
        <div className="virtual-tree__toolbar">
            <div className="virtual-tree__toolbar-row">
                <div className="virtual-tree__toolbar-search">
                    <TreeViewSearch
                        onSearch={onSearch}
                        value={searchValue}
                        id="input-search"
                        name="search-input"
                        aria-label="Search input example"
                    />
                </div>
                <div className="virtual-tree__toolbar-actions">
                    {expandAllDisabled ? (
                        <Tooltip content={t("tableExplorer.expandAllLimit")}>
                            <span className="virtual-tree__expand-guard">{expandAllButton}</span>
                        </Tooltip>
                    ) : expandAllButton}
                </div>
            </div>
            {isFiltered && filteredItems.length > 0 ? (
                <div className="virtual-tree__results" aria-live="polite">
                    <span className="virtual-tree__results-label">{resultsLabel}</span>
                    <Button
                        variant="link"
                        isInline
                        type="button"
                        className="virtual-tree__results-clear"
                        onClick={() => updateSearch("")}
                    >
                        {t("search.button")}
                    </Button>
                </div>
            ) : null}
        </div>
    );

    const searchMiss = isFiltered && filteredItems.length === 0;

    return (
        <div className="virtual-tree">
            {toolbar}
            <div
                className={`virtual-tree__summary${hasSelection ? "" : " virtual-tree__summary--empty"}`}
                aria-live="polite"
            >
                {hasSelection ? (
                    <>
                        <span className="virtual-tree__summary-caption">{t("tableExplorer.selected")}</span>
                        {schemaLabel ? (
                            <span className="virtual-tree__summary-count">
                                <Label isCompact color="blue">{schemaLabel}</Label>
                            </span>
                        ) : null}
                        {tableLabel ? (
                            <span className="virtual-tree__summary-count">
                                <Label isCompact color="blue">{tableLabel}</Label>
                            </span>
                        ) : null}
                        <SelectionListPopover groups={groups} />
                    </>
                ) : t("tableExplorer.selectedNone")}
            </div>
            <div
                ref={scrollContainerRef}
                className="virtual-tree__scroll-area"
            >
                {searchMiss ? (
                    <Bullseye className="virtual-tree__empty">
                        <EmptyState
                            headingLevel="h2"
                            titleText={t("tableExplorer.emptyTitle")}
                            icon={SearchIcon}
                            variant={EmptyStateVariant.sm}
                        >
                            <EmptyStateBody>{t("search.description")}</EmptyStateBody>
                            <EmptyStateFooter>
                                <EmptyStateActions>
                                    <Button variant="link" onClick={() => updateSearch("")}>
                                        {t("search.button")}
                                    </Button>
                                </EmptyStateActions>
                            </EmptyStateFooter>
                        </EmptyState>
                    </Bullseye>
                ) : (
                    <>
                        {pinnedItem ? (
                            <div
                                className="virtual-tree__pinned-schema"
                                style={{ height: ROW_HEIGHT, marginBottom: -ROW_HEIGHT }}
                            >
                                <div className="virtual-tree__row">
                                    <TreeRow
                                        item={pinnedItem.item}
                                        depth={0}
                                        hasChildren={pinnedItem.hasChildren}
                                        expanded={isNodeExpanded(pinnedItem.item.id)}
                                        readOnly={readOnly}
                                        countLabel={descendantChecked.schemaCounts.get(pinnedItem.item.id)}
                                        onToggle={onToggleNode}
                                        onCheck={onCheck}
                                    />
                                </div>
                            </div>
                        ) : null}
                        <div
                            style={{
                                height: `${virtualizer.getTotalSize()}px`,
                                width: "100%",
                                position: "relative",
                            }}
                        >
                            {virtualizer.getVirtualItems().map((virtualRow) => {
                                const { item, depth, hasChildren } = visibleItems[virtualRow.index];
                                const expanded = hasChildren && isNodeExpanded(item.id);
                                const scrolledOff = pinnedItem != null
                                    && depth === 0
                                    && item.id === pinnedItem.item.id
                                    && virtualRow.start < scrollOffset;

                                return (
                                    <div
                                        key={item.id}
                                        className={`virtual-tree__row ${depth > 0 ? "virtual-tree__row--child" : ""}`}
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            width: "100%",
                                            height: `${virtualRow.size}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                        inert={scrolledOff || undefined}
                                        aria-hidden={scrolledOff || undefined}
                                    >
                                        <TreeRow
                                            item={item}
                                            depth={depth}
                                            hasChildren={hasChildren}
                                            expanded={expanded}
                                            readOnly={readOnly}
                                            countLabel={hasChildren ? descendantChecked.schemaCounts.get(item.id) : undefined}
                                            onToggle={onToggleNode}
                                            onCheck={onCheck}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TableViewComponent;
