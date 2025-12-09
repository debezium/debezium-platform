import { Button, Toolbar, ToolbarContent, ToolbarItem, TreeView, TreeViewDataItem, TreeViewSearch } from "@patternfly/react-core";
import { DatabaseIcon, ServerGroupIcon } from "@patternfly/react-icons";
import { FC, useState, useEffect, useRef } from "react";
import { Fragment } from "react/jsx-runtime";
import { TableData } from "src/apis";
import "./TableViewComponent.css";
import { useTranslation } from "react-i18next";
import { SelectedDataListItem } from "@sourcePage/CreateSource";

type TableViewComponentProps = {
    collections: TableData | undefined;
    setSelectedDataListItems: (dataListItems: SelectedDataListItem | undefined) => void;
    selectedDataListItems: SelectedDataListItem | undefined;
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

      } else if (isTable ) {
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
  
  

const TableViewComponent: FC<TableViewComponentProps> = ({ collections, setSelectedDataListItems, selectedDataListItems }) => {
    const { t } = useTranslation();
    const [allExpanded, setAllExpanded] = useState(false);
    const [filteredItems, setFilteredItems] = useState<TreeViewDataItem[]>([]);
    const [isFiltered, setIsFiltered] = useState(false);

    const [options, setOptions] = useState<TreeViewDataItem[]>([]);

    const [checkedItems, setCheckedItems] = useState<TreeViewDataItem[]>([]);
    
    const isInitializedRef = useRef(false);

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
        
        if (!selectedDataListItems) {
            isInitializedRef.current = true;
            setCheckedItems([]);
            return;
        }

        const { schemas, tables } = selectedDataListItems;
        
        if (schemas.length === 0 && tables.length === 0) {
            isInitializedRef.current = true;
            if (checkedItems.length > 0) {
                setCheckedItems([]);
            }
            return;
        }

        const currentSelections = extractSelections(checkedItems as SelectedItem[]);
        const schemasMatch = 
            currentSelections.schemas.length === schemas.length &&
            currentSelections.schemas.every(s => schemas.includes(s)) &&
            schemas.every(s => currentSelections.schemas.includes(s));
        const tablesMatch = 
            currentSelections.tables.length === tables.length &&
            currentSelections.tables.every(t => tables.includes(t)) &&
            tables.every(t => currentSelections.tables.includes(t));

        if (schemasMatch && tablesMatch) {
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
    }, [selectedDataListItems, options]);

    useEffect(() => {
        if (!isInitializedRef.current) return;
        
        const selections = extractSelections(checkedItems as SelectedItem[]);
        setSelectedDataListItems(selections);
    }, [checkedItems, setSelectedDataListItems]);


    useEffect(() => {
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
    }, [collections]);

    const onCheck = (event: React.ChangeEvent, treeViewItem: TreeViewDataItem) => {
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

    const onToggle = () => {
        setAllExpanded((prevAllExpanded) => !prevAllExpanded);
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
        // Reset checked properties to be updated
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

    // Filter function for checkbox selection - filters tree to find matching item and its descendants
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

    // Filter function for search - filters tree based on name matching search input
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

    // Map the filtered items with checkbox states
    const mappedFilteredItems = filteredItems.map((item) => mapTree(item));

    const toolbar = (
        <Toolbar style={{ padding: 0 }}>
            <ToolbarContent style={{ padding: 0 }}>
                <ToolbarItem>
                    <TreeViewSearch onSearch={onSearch} id="input-search" name="search-input" aria-label="Search input example" />
                </ToolbarItem>
                <ToolbarItem className="tree-view-component__toolbar-expand">
                    <Button variant="link" onClick={onToggle} >
                        {allExpanded && t('collapseAll')}
                        {!allExpanded && t('expandAll')}
                    </Button>
                </ToolbarItem>
            </ToolbarContent>
        </Toolbar>
    );


    return (
        <Fragment>
            <TreeView
                hasAnimations
                aria-label="Tree View with search and checkboxes"
                data={mappedFilteredItems}
                onCheck={onCheck}
                hasCheckboxes
                allExpanded={allExpanded || isFiltered}
                toolbar={toolbar}
                useMemo={true}
            />
        </Fragment>
    );
};

export default TableViewComponent;