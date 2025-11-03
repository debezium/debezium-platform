import { Button, Toolbar, ToolbarContent, ToolbarItem, TreeView, TreeViewDataItem, TreeViewSearch } from "@patternfly/react-core";
import { FC, useState, useEffect } from "react";
import { Fragment } from "react/jsx-runtime";
import { TableData } from "src/apis";

type TableViewComponentProps = {
    collections: TableData | undefined;
    //   onToggle: () => void;
    //   allExpanded: boolean;
    //   tree: React.ReactNode;
};

const TableViewComponent: FC<TableViewComponentProps> = ({ collections }) => {

    const [activeItems, setActiveItems] = useState<TreeViewDataItem[]>();
    const [allExpanded, setAllExpanded] = useState(false);

    const [filteredItems, setFilteredItems] = useState<TreeViewDataItem[]>([]);
    const [isFiltered, setIsFiltered] = useState(false);
    const [options, setOptions] = useState<TreeViewDataItem[]>([]);

    const tableData = {
        catalogs: [
            {
                name: null,
                schemas: [
                    {
                        name: "inventory",
                        collections: [
                            {
                                name: "spatial_ref_sys",
                                fullyQualifiedName: "inventory.spatial_ref_sys"
                            },
                            {
                                name: "geom",
                                fullyQualifiedName: "inventory.geom"
                            },
                            {
                                name: "products_on_hand",
                                fullyQualifiedName: "inventory.products_on_hand"
                            },
                            {
                                name: "customers",
                                fullyQualifiedName: "inventory.customers"
                            },
                            {
                                name: "orders",
                                fullyQualifiedName: "inventory.orders"
                            },
                            {
                                name: "products",
                                fullyQualifiedName: "inventory.products"
                            }
                        ],
                        collectionCount: 6
                    },
                    {
                        name: "orders",
                        collections: [
                            {
                                name: "ongoing_orders",
                                fullyQualifiedName: "orders.ongoing_orders"
                            },
                            {
                                name: "in_cart_orders",
                                fullyQualifiedName: "orders.in_cart_orders"
                            },
                            {
                                name: "completed_orders",
                                fullyQualifiedName: "orders.completed_orders"
                            },
                            {
                                name: "cancelled_orders",
                                fullyQualifiedName: "orders.cancelled_orders"
                            }
                        ],
                        collectionCount: 4
                    }
                ],
                totalCollections: 4
            }
        ]
    };

    console.log("collections", collections, "tableData", tableData);

    // Transform tableData into TreeViewDataItem compatible options
    useEffect(() => {
        const newOptions: TreeViewDataItem[] = [];
        
        if (collections && collections.catalogs) {
            collections.catalogs.forEach((catalog) => {
                if (catalog.schemas) {
                    catalog.schemas.forEach((schema, schemaIdx) => {
                        const collectionsChildren: TreeViewDataItem[] = [];
                        if (schema.collections) {
                            schema.collections.forEach((collection, collIdx) => {
                                collectionsChildren.push({
                                    name: collection.name,
                                    id: `schema${schemaIdx}-collection${collIdx}`,
                                });
                            });
                        }
                        newOptions.push({
                            name: schema.name,
                            id: `schema${schemaIdx}`,
                            children: collectionsChildren
                        });
                    });
                }
            });
        }
        
        setOptions(newOptions);
        setFilteredItems(newOptions);
    }, [collections]);

    // if (tableData && tableData.catalogs) {
    //     tableData.catalogs.forEach((catalog) => {
    //         if (catalog.schemas) {
    //             catalog.schemas.forEach((schema, schemaIdx) => {
    //                 const collectionsChildren: TreeViewDataItem[] = [];
    //                 if (schema.collections) {
    //                     schema.collections.forEach((collection, collIdx) => {
    //                         collectionsChildren.push({
    //                             name: collection.name,
    //                             id: `schema${schemaIdx}-collection${collIdx}`,
    //                         });
    //                     });
    //                 }
    //                 options.push({
    //                     name: schema.name,
    //                     id: `schema${schemaIdx}`,
    //                     children: collectionsChildren
    //                 });
    //             });
    //         }
    //     });
    // }

    const onSelect = (_event: React.MouseEvent, treeViewItem: TreeViewDataItem) => {
        // Ignore folders for selection
        if (treeViewItem && !treeViewItem.children) {
            setActiveItems([treeViewItem]);
        }
    };

    const onSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
        const input = event.target.value;
        if (input === '') {
            setFilteredItems(options);
            setIsFiltered(false);
        } else {
            const filtered = options.map((opt) => Object.assign({}, opt)).filter((item) => filterItems(item, input));
            setFilteredItems(filtered);
            setIsFiltered(true);
        }
    };

    const onToggle = (_event: React.MouseEvent) => {
        setAllExpanded((prevAllExpanded) => !prevAllExpanded);
    };

    const filterItems = (item: TreeViewDataItem, input: string): boolean => {
        const itemName = typeof item.name === 'string' ? item.name : String(item.name || '');
        if (itemName.toLowerCase().includes(input.toLowerCase())) {
            return true;
        }
        if (item.children) {
            return (
                (item.children = item.children
                    .map((opt: TreeViewDataItem) => Object.assign({}, opt))
                    .filter((child: TreeViewDataItem) => filterItems(child, input))).length > 0
            );
        }
        return false;
    };



    const toolbar = (
        <Toolbar style={{ padding: 0 }}>
            <ToolbarContent style={{ padding: 0 }}>
                <ToolbarItem>
                    <TreeViewSearch onSearch={onSearch} id="input-search" name="search-input" aria-label="Search input example" />
                </ToolbarItem>
                <ToolbarItem>
                    <Button variant="link" onClick={onToggle} className="pf-v6-c-tree-view__search">
                        {allExpanded && 'Collapse all'}
                        {!allExpanded && 'Expand all'}
                    </Button>
                </ToolbarItem>
            </ToolbarContent>
        </Toolbar>
    );

    const tree = filteredItems.length > 0 ? (
        <TreeView
            hasAnimations
            aria-label="Tree View with memoization example"
            data={filteredItems}
            activeItems={activeItems}
            onSelect={onSelect}
            allExpanded={allExpanded || isFiltered}
            toolbar={toolbar}
            useMemo={true}
        />
    ) : null;
    
    return (
        <Fragment>
            {tree}
        </Fragment>
    );
};

export default TableViewComponent;