import { Button, Toolbar, ToolbarContent, ToolbarItem, TreeViewDataItem, TreeViewSearch } from "@patternfly/react-core";
import { AngleRightIcon, DatabaseIcon, ServerGroupIcon } from "@patternfly/react-icons";
import { FC, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { TableData } from "src/apis";
import "./TableViewComponent.css";
import { useTranslation } from "react-i18next";
import { SelectedDataListItem } from "@sourcePage/CreateSource";
import { useVirtualizer } from "@tanstack/react-virtual";

type TableViewComponentProps = {
    collections: TableData | undefined;
    setSelectedDataListItems: (dataListItems: SelectedDataListItem | undefined) => void;
    selectedDataListItems: SelectedDataListItem | undefined;
    readOnly?: boolean;
};

type SelectedItem = {
    name: string;
    id: string;
    checkProps: { checked?: boolean | null; "aria-label"?: string };
    children?: SelectedItem[];
};

type SelectionResult = {
    schemas: string[];
    tables: string[];
};

type FlatItem = {
    item: TreeViewDataItem;
    depth: number;
    hasChildren: boolean;
};

export function extractSelections(selectedItems: SelectedItem[]): SelectionResult {
    const schemaSet = new Set<string>();
    const tableSet = new Set<string>();

    for (const item of selectedItems) {
        const isSchema = item.id.includes("schema") && !item.id.includes("collection");
        const isTable = item.id.includes("collection");

        if (isSchema) {
            if (item.checkProps.checked === true) {
                schemaSet.add(item.name);
            }

        } else if (isTable) {
            const schemaFromId = item.id.match(/^schema-\d+-(.*?)-collection-/)?.[1];
            const schemaName = schemaFromId ?? "unknown_schema";
            tableSet.add(`${schemaName}.${item.name}`);
        }
    }

    // Remove tables belonging to fully selected schemas
    for (const schema of schemaSet) {
        const tables = Array.from(tableSet)
            .filter((t) => t.startsWith(`${schema}.`))
            .map((t) => t.substring(schema.length + 1));
        const allTablesSelected = tables.every((t) =>
            tableSet.has(`${schema}.${t}`)
        );

        if (allTablesSelected) {
            tables.forEach((t) => tableSet.delete(`${schema}.${t}`));
        }
    }

    return {
        schemas: Array.from(schemaSet),
        tables: Array.from(tableSet),
    };
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

const TableViewComponent: FC<TableViewComponentProps> = ({ collections, setSelectedDataListItems, selectedDataListItems, readOnly }) => {
    const { t } = useTranslation();
    const [allExpanded, setAllExpanded] = useState(false);
    const [filteredItems, setFilteredItems] = useState<TreeViewDataItem[]>([]);
    const [isFiltered, setIsFiltered] = useState(false);
    const [options, setOptions] = useState<TreeViewDataItem[]>([]);
    const [checkedItems, setCheckedItems] = useState<TreeViewDataItem[]>([]);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isInitializedRef = useRef(false);
    const prevSelectionRef = useRef<{ selectedDataListItems: SelectedDataListItem | undefined; options: TreeViewDataItem[] }>({
        selectedDataListItems: undefined,
        options: []
    });
    const prevCollectionsRef = useRef<TableData | undefined>(undefined);

    const flattenTreeItems = (tree: TreeViewDataItem[]): TreeViewDataItem[] => {
        let result: TreeViewDataItem[] = [];
        tree.forEach((item) => {
            result.push(item);
            if (item.children) {
                result = result.concat(flattenTreeItems(item.children));
            }
        });
        return result;
    };

    useEffect(() => {
        if (options.length === 0) return;
        const prev = prevSelectionRef.current;
        const selectionChanged = prev.selectedDataListItems !== selectedDataListItems;
        const optionsChanged = prev.options !== options;

        if (!selectionChanged && !optionsChanged) {
            return;
        }
        prevSelectionRef.current = { selectedDataListItems, options };

        queueMicrotask(() => {
            if (!selectedDataListItems) {
                setCheckedItems([]);
                isInitializedRef.current = true;
                return;
            }

            const { schemas, tables } = selectedDataListItems;

            if (schemas.length === 0 && tables.length === 0) {
                setCheckedItems([]);
                isInitializedRef.current = true;
                return;
            }

            const flatItems = flattenTreeItems(options);
            const newCheckedItems: TreeViewDataItem[] = [];

            for (const item of flatItems) {
                const itemId = item.id as string;
                const itemName = item.name as string;
                const isSchemaItem = itemId.includes("schema") && !itemId.includes("collection");
                const isTableItem = itemId.includes("collection");

                if (isSchemaItem && schemas.includes(itemName)) {
                    newCheckedItems.push(item);
                    if (item.children) {
                        newCheckedItems.push(...item.children);
                    }
                } else if (isTableItem) {
                    const schemaFromId = itemId.match(/^schema-\d+-(.*?)-collection-/)?.[1];
                    const tableName = `${schemaFromId}.${itemName}`;
                    if (tables.includes(tableName)) {
                        newCheckedItems.push(item);
                    }
                }
            }

            setCheckedItems(newCheckedItems);
            isInitializedRef.current = true;
        });
    }, [selectedDataListItems, options]);

    useEffect(() => {
        if (!isInitializedRef.current || readOnly) return;

        const selections = extractSelections(checkedItems as SelectedItem[]);
        setSelectedDataListItems(selections);
    }, [checkedItems, setSelectedDataListItems, readOnly]);

    useEffect(() => {
        if (prevCollectionsRef.current === collections) {
            return;
        }
        prevCollectionsRef.current = collections;
        queueMicrotask(() => {
            const newOptions: TreeViewDataItem[] = [];
            if (collections && collections.catalogs) {
                collections.catalogs.forEach((catalog) => {
                    if (catalog.schemas) {
                        catalog.schemas.forEach((schema, schemaIdx) => {
                            const collectionsChildren: TreeViewDataItem[] = [];
                            if (schema.collections) {
                                schema.collections.forEach((collection) => {
                                    collectionsChildren.push({
                                        name: collection.name,
                                        id: `schema-${schemaIdx}-${schema.name}-collection-${collection.name}`,
                                        icon: <ServerGroupIcon />,
                                        checkProps: { checked: false }
                                    });
                                });
                            }
                            newOptions.push({
                                name: schema.name,
                                id: `schema-${schemaIdx}-${schema.name}`,
                                icon: <DatabaseIcon />,
                                checkProps: { 'aria-label': 'schema', checked: false },
                                children: collectionsChildren
                            });
                        });
                    }
                });
            }

            setOptions(newOptions);
            setFilteredItems(newOptions);
        });
    }, [collections]);

    const onCheck = (event: React.ChangeEvent, treeViewItem: TreeViewDataItem) => {
        if (readOnly) return;
        const checked = (event.target as HTMLInputElement).checked;
        const checkedItemTree = options
            .map((opt) => Object.assign({}, opt))
            .filter((item) => filterItemsForCheck(item, treeViewItem));
        const flatCheckedItems = flattenTree(checkedItemTree);

        setCheckedItems((prevCheckedItems) =>
            checked
                ? prevCheckedItems.concat(flatCheckedItems.filter((item) => !checkedItems.some((i) => i.id === item.id)))
                : prevCheckedItems.filter((item) => !flatCheckedItems.some((i) => i.id === item.id))
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

    const isChecked = (dataItem: TreeViewDataItem): boolean => checkedItems.some((item) => item.id === dataItem.id);
    const areAllDescendantsChecked = (dataItem: TreeViewDataItem): boolean =>
        dataItem.children ? dataItem.children.every((child) => areAllDescendantsChecked(child)) : isChecked(dataItem);
    const areSomeDescendantsChecked = (dataItem: TreeViewDataItem): boolean =>
        dataItem.children ? dataItem.children.some((child) => areSomeDescendantsChecked(child)) : isChecked(dataItem);

    const flattenTree = (tree: TreeViewDataItem[]) => {
        let result: TreeViewDataItem[] = [];
        tree.forEach((item) => {
            result.push(item);
            if (item.children) {
                result = result.concat(flattenTree(item.children));
            }
        });
        return result;
    };

    const mapTree = (item: TreeViewDataItem): TreeViewDataItem => {
        const hasCheck = areAllDescendantsChecked(item);
        if (item.checkProps) {
            item.checkProps.checked = false;

            if (hasCheck) {
                item.checkProps.checked = true;
            } else {
                const hasPartialCheck = areSomeDescendantsChecked(item);
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

    const filterItemsForCheck = (item: TreeViewDataItem, checkedItem: TreeViewDataItem): boolean => {
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

    const filterItemsForSearch = (item: TreeViewDataItem, input: string): boolean => {
        const itemName = typeof item.name === 'string' ? item.name : String(item.name || '');
        if (itemName.toLowerCase().includes(input.toLowerCase())) {
            return true;
        }
        if (item.children) {
            return (
                (item.children = item.children
                    .map((opt: TreeViewDataItem) => Object.assign({}, opt))
                    .filter((child: TreeViewDataItem) => filterItemsForSearch(child, input))).length > 0
            );
        }
        return false;
    };

    const mappedFilteredItems = filteredItems.map((item) => mapTree(item));

    // Expand/collapse handlers
    const isNodeExpanded = useCallback(
        (id: string) => allExpanded || isFiltered || expandedIds.has(id),
        [allExpanded, isFiltered, expandedIds]
    );

    const onToggleNode = useCallback((id: string) => {
        if (allExpanded || isFiltered) {
            const allIds = new Set(options.map(item => item.id as string));
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
    }, [allExpanded, isFiltered, options]);

    const onToggleAll = () => {
        if (allExpanded) {
            setExpandedIds(new Set());
            setAllExpanded(false);
        } else {
            setAllExpanded(true);
        }
    };

    // Flatten tree into visible rows based on expand state
    const visibleItems = useMemo((): FlatItem[] => {
        const result: FlatItem[] = [];
        for (const item of mappedFilteredItems) {
            const id = item.id as string;
            const expanded = allExpanded || isFiltered || expandedIds.has(id);
            result.push({ item, depth: 0, hasChildren: !!item.children?.length });
            if (expanded && item.children) {
                for (const child of item.children) {
                    result.push({ item: child, depth: 1, hasChildren: false });
                }
            }
        }
        return result;
    }, [mappedFilteredItems, allExpanded, isFiltered, expandedIds]);

    const virtualizer = useVirtualizer({
        count: visibleItems.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: () => 36,
        overscan: 20,
    });

    const toolbar = (
        <Toolbar style={{ padding: 0 }}>
            <ToolbarContent style={{ padding: 0 }}>
                <ToolbarItem>
                    <TreeViewSearch
                        onSearch={readOnly ? () => {} : onSearch}
                        id="input-search"
                        name="search-input"
                        aria-label="Search input example"
                    />
                </ToolbarItem>
                <ToolbarItem className="tree-view-component__toolbar-expand">
                    <Button variant="link" onClick={onToggleAll}>
                        {allExpanded && t('collapseAll')}
                        {!allExpanded && t('expandAll')}
                    </Button>
                </ToolbarItem>
            </ToolbarContent>
        </Toolbar>
    );

    return (
        <div className="virtual-tree">
            <div className="virtual-tree__toolbar">
                {toolbar}
            </div>
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
                        const expanded = hasChildren && isNodeExpanded(item.id as string);

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
                                            onClick={() => onToggleNode(item.id as string)}
                                            aria-label={expanded ? 'Collapse' : 'Expand'}
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
                                        {depth === 0 ? <DatabaseIcon /> : <ServerGroupIcon />}
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
