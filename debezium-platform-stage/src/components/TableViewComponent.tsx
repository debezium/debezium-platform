import { Button, TreeViewSearch } from "@patternfly/react-core";
import { AngleRightIcon, DatabaseIcon, ServerGroupIcon } from "@patternfly/react-icons";
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

const TableViewComponent: FC<TableViewComponentProps> = ({
    collections,
    setSelectedDataListItems,
    selectedDataListItems,
    binding = LEGACY_EXPLORER_BINDING,
    readOnly,
}) => {
    const { t } = useTranslation();
    const [allExpanded, setAllExpanded] = useState(false);
    const [filteredItems, setFilteredItems] = useState<ExplorerNode[]>([]);
    const [isFiltered, setIsFiltered] = useState(false);
    const [options, setOptions] = useState<ExplorerNode[]>([]);
    const [checkedItems, setCheckedItems] = useState<ExplorerNode[]>([]);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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
        const visit = (item: ExplorerNode) => {
            if (!item.children?.length) {
                const checked = checkedIds.has(item.id);
                allChecked.set(item.id, checked);
                someChecked.set(item.id, checked);
                return;
            }
            for (const child of item.children) {
                visit(child);
            }
            allChecked.set(item.id, item.children.every((child) => allChecked.get(child.id)));
            someChecked.set(item.id, item.children.some((child) => someChecked.get(child.id)));
        };
        for (const item of options) {
            visit(item);
        }
        return { allChecked, someChecked };
    }, [options, checkedItems]);

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

        setCheckedItems((prevCheckedItems) =>
            checked
                ? prevCheckedItems.concat(itemsToToggle.filter((item) => !prevCheckedItems.some((i) => i.id === item.id)))
                : prevCheckedItems.filter((item) => !itemsToToggle.some((i) => i.id === item.id))
        );
    };

    const onSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
        const input = event.target.value;
        if (input === '') {
            setFilteredItems(options);
            setIsFiltered(false);
        } else {
            const filtered = options.map((opt) => Object.assign({}, opt)).filter((item) => filterItemsForSearch(item, input));
            setFilteredItems(filtered);
            setIsFiltered(true);
        }
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
        const itemName = typeof item.name === 'string' ? item.name : String(item.name || '');
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

    const isNodeExpanded = useCallback(
        (id: string) => allExpanded || isFiltered || expandedIds.has(id),
        [allExpanded, isFiltered, expandedIds]
    );

    const onToggleNode = useCallback((id: string) => {
        if (readOnly) return;
        if (allExpanded || isFiltered) {
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

    const onToggleAll = () => {
        if (readOnly) return;
        if (allExpanded) {
            setExpandedIds(new Set());
            setAllExpanded(false);
        } else {
            setAllExpanded(true);
        }
    };

    const visibleItems = useMemo((): FlatItem[] => {
        const result: FlatItem[] = [];
        const walk = (items: ExplorerNode[], depth: number) => {
            for (const item of items) {
                const hasChildren = !!item.children?.length;
                result.push({ item, depth, hasChildren });
                const expanded = hasChildren && (allExpanded || isFiltered || expandedIds.has(item.id));
                if (expanded && item.children) walk(item.children, depth + 1);
            }
        };
        walk(mappedFilteredItems, 0);
        return result;
    }, [mappedFilteredItems, allExpanded, isFiltered, expandedIds]);

    const virtualizer = useVirtualizer({
        count: visibleItems.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: () => 36,
        overscan: 20,
    });

    const toolbar = readOnly ? null : (
        <div className="virtual-tree__toolbar-row">
            <div className="virtual-tree__toolbar-search">
                <TreeViewSearch
                    onSearch={onSearch}
                    id="input-search"
                    name="search-input"
                    aria-label="Search input example"
                />
            </div>
            <div className="virtual-tree__toolbar-actions">
                <Button variant="link" onClick={onToggleAll}>
                    {allExpanded && t('collapseAll')}
                    {!allExpanded && t('expandAll')}
                </Button>
            </div>
        </div>
    );

    return (
        <div className="virtual-tree">
            {toolbar ? <div className="virtual-tree__toolbar">{toolbar}</div> : null}
            <div
                ref={scrollContainerRef}
                className="virtual-tree__scroll-area"
            >
                <div
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const { item, depth, hasChildren } = visibleItems[virtualRow.index];
                        const expanded = hasChildren && isNodeExpanded(item.id);

                        return (
                            <div
                                key={item.id}
                                className={`virtual-tree__row ${depth > 0 ? 'virtual-tree__row--child' : ''}`}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                <div
                                    className="virtual-tree__row-content"
                                    style={{ paddingLeft: `${depth * 24 + 8}px` }}
                                >
                                    {hasChildren ? (
                                        <button
                                            type="button"
                                            className={`virtual-tree__toggle ${expanded ? 'virtual-tree__toggle--expanded' : ''}`}
                                            onClick={() => onToggleNode(item.id)}
                                            aria-label={expanded ? 'Collapse' : 'Expand'}
                                            disabled={readOnly}
                                        >
                                            <AngleRightIcon />
                                        </button>
                                    ) : (
                                        <span className="virtual-tree__toggle-spacer" />
                                    )}
                                    <TreeCheckbox
                                        checked={item.checkProps?.checked}
                                        onChange={(e) => onCheck(e as unknown as React.ChangeEvent, item)}
                                        ariaLabel={`Select ${item.name}`}
                                        disabled={readOnly}
                                    />
                                    <span className="virtual-tree__icon">
                                        {item.level === "collection" ? <ServerGroupIcon /> : <DatabaseIcon />}
                                    </span>
                                    <span className="virtual-tree__name">{item.name}</span>
                                    {hasChildren && item.children && (
                                        <span className="virtual-tree__count">
                                            ({item.children.length})
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TableViewComponent;
