import { Button, Toolbar, ToolbarContent, ToolbarItem, TreeView, TreeViewDataItem, TreeViewSearch } from "@patternfly/react-core";
import { FC, useEffect, useState } from "react";
import { Fragment } from "react/jsx-runtime";

type TableViewComponentProps = {
    //   onToggle: () => void;
    //   allExpanded: boolean;
    //   tree: React.ReactNode;
};

const TableViewDataItem = {
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
                }
            ],
            totalCollections: 6
        }
    ]
}

const transformedTableViewDataItem = {
    name: 'inventory',
    id: 'schema-inventory',
    children: [
      {
        name: 'spatial_ref_sys 1',
        id: 'inventory.spatial_ref_sys',
      },
    {
        name: 'geom 1',
        id: 'inventory.geom',
      },
    {
        name: 'products_on_hand 1',
        id: 'inventory.products_on_hand',
      },
    {
        name: 'customers 1',
        id: 'inventory.customers',
      },
    {
        name: 'orders 1',
        id: 'inventory.orders',
      },
    {
        name: 'products 1',
        id: 'inventory.products',
      }
    ]
}

const options = [
    {
      name: 'Application launcher',
      id: 'example2-AppLaunch',
      children: [
        {
          name: 'Application 1',
          id: 'example2-App1',
          children: [
            { name: 'Settings', id: 'example2-App1Settings' },
            { name: 'Current', id: 'example2-App1Current' }
          ]
        },
        {
          name: 'Application 2',
          id: 'example2-App2',
          children: [
            { name: 'Settings', id: 'example2-App2Settings' },
            {
              name: 'Loader',
              id: 'example2-App2Loader',
              children: [
                { name: 'Loading App 1', id: 'example2-LoadApp1' },
                { name: 'Loading App 2', id: 'example2-LoadApp2' },
                { name: 'Loading App 3', id: 'example2-LoadApp3' }
              ]
            }
          ]
        }
      ],
      defaultExpanded: true
    },
    {
      name: 'Cost management',
      id: 'example2-Cost',
      children: [
        {
          name: 'Application 3',
          id: 'example2-App3',
          children: [
            { name: 'Settings', id: 'example2-App3Settings' },
            { name: 'Current', id: 'example2-App3Current' }
          ]
        }
      ]
    },
    {
      name: 'Sources',
      id: 'example2-Sources',
      children: [
        {
          name: 'Application 4',
          id: 'example2-App4',
          children: [{ name: 'Settingexample2-s', id: 'example2-App4Settings' }]
        }
      ]
    },
    {
      name: 'Really really really long folder name that overflows the container it is in',
      id: 'example2-Long',
      children: [{ name: 'Application 5', id: 'example2-App5' }]
    }
  ];


const TableViewComponent: FC<TableViewComponentProps> = () => {

    const [activeItems, setActiveItems] = useState<TreeViewDataItem[]>();
    const [allExpanded, setAllExpanded] = useState(false);

    const [filteredItems, setFilteredItems] = useState();
    const [isFiltered, setIsFiltered] = useState(false);

    useEffect(() => {
        setFilteredItems(transformedTableViewDataItem);
    }, []);

    const onSelect = (_event: React.MouseEvent, treeViewItem: TreeViewDataItem) => {
        const filtered: TreeViewDataItem[] = [];
        options.forEach((item) => filterItems(item, treeViewItem.id, filtered));
        if (treeViewItem && !treeViewItem.children) {
            setActiveItems(filtered);
        }
    };

    const onToggle = (_event: React.MouseEvent) => {
        setAllExpanded((prevAllExpanded) => !prevAllExpanded);
    };

    const filterItems = (item: TreeViewDataItem, input: string | undefined, list: TreeViewDataItem[]) => {
        if (item.children) {
            let childContained = false;
            item.children.forEach((child) => {
                if (childContained) {
                    filterItems(child, input, list);
                } else {
                    childContained = filterItems(child, input, list);
                }
            });
            if (childContained) {
                list.push(item);
            }
        }

        if (item.id === input) {
            list.push(item);
            return true;
        } else {
            return false;
        }
    };

    const options: TreeViewDataItem[] = [];
    for (let i = 1; i <= 20; i++) {
        const childNum = 5;
        const childOptions: TreeViewDataItem[] = [];
        for (let j = 1; j <= childNum; j++) {
            childOptions.push({ name: 'Child ' + j, id: `Option${i} - Child${j}` });
        }
        options.push({ name: 'Option ' + i, id: i.toString(), children: childOptions });
    }

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
    const filterItems = (item, input) => {
        if (item.name.toLowerCase().includes(input.toLowerCase())) {
            return true;
        }
        if (item.children) {
            return (
                (item.children = item.children
                    .map((opt) => Object.assign({}, opt))
                    .filter((child) => filterItems(child, input))).length > 0
            );
        }
    };

    const toolbar = (
        <Toolbar style={{ padding: 0 }}>
            <ToolbarContent style={{ padding: 0 }}>
                <ToolbarItem>
                    <TreeViewSearch onSearch={onSearch} id="input-search" name="search-input" aria-label="Search input example" />
                </ToolbarItem>
                <ToolbarItem>
                    <Button variant="link" onClick={onToggle}>
                        {allExpanded && 'Collapse all'}
                        {!allExpanded && 'Expand all'}
                    </Button>
                </ToolbarItem>
            </ToolbarContent>
        </Toolbar>
    );

    const tree = (
        <TreeView
            hasAnimations
            aria-label="Tree View with memoization example"
            data={options}
            activeItems={activeItems}
            onSelect={onSelect}
            allExpanded={allExpanded}
            toolbar={toolbar}
            useMemo
        />
    );
    return (
        <Fragment>

            {tree}
        </Fragment>
    );
};

export default TableViewComponent;