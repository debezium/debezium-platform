import { SelectedDataListItem, TableData } from "../apis/types";
import { ExplorerBinding, isPresentName } from "./Datatype";

export type ExplorerLevel = "catalog" | "schema" | "collection";

export type ExplorerNode = {
    name: string;
    id: string;
    level: ExplorerLevel;
    /** Catalog include-list property this node writes, or null when the node is only a group. */
    propertyName: string | null;
    selectionValue: string;
    fullyQualifiedName?: string;
    checkProps: { checked?: boolean | null };
    children?: ExplorerNode[];
};

function pushUnique(list: string[], value: string) {
    if (!list.includes(value)) list.push(value);
}

/**
 * Builds the checkbox tree from the collections response.
 * Blank catalog or schema levels are skipped and their children are attached to the named parent.
 */
export function buildExplorerTree(
    collections: TableData | undefined,
    binding: ExplorerBinding
): ExplorerNode[] {
    if (!collections?.catalogs?.length) return [];
    const roots: ExplorerNode[] = [];

    collections.catalogs.forEach((catalog, catalogIdx) => {
        const schemaLevel: ExplorerNode[] = [];
        (catalog.schemas ?? []).forEach((schema, schemaIdx) => {
            const leaves: ExplorerNode[] = (schema.collections ?? []).map((collection, collectionIdx) => {
                const fullyQualifiedName = collection.fullyQualifiedName || collection.name;
                return {
                    name: collection.name,
                    id: `c${catalogIdx}-s${schemaIdx}-l${collectionIdx}-${fullyQualifiedName}`,
                    level: "collection",
                    propertyName: binding.leafProperty,
                    selectionValue: fullyQualifiedName,
                    fullyQualifiedName,
                    checkProps: { checked: false },
                };
            });

            if (isPresentName(schema.name)) {
                schemaLevel.push({
                    name: schema.name,
                    id: `c${catalogIdx}-s${schemaIdx}-${schema.name}`,
                    level: "schema",
                    propertyName: binding.schemaProperty,
                    selectionValue: schema.name,
                    checkProps: { checked: false },
                    children: leaves,
                });
            } else {
                schemaLevel.push(...leaves);
            }
        });

        if (isPresentName(catalog.name)) {
            roots.push({
                name: catalog.name,
                id: `c${catalogIdx}-${catalog.name}`,
                level: "catalog",
                propertyName: binding.catalogProperty,
                selectionValue: catalog.name,
                checkProps: { checked: false },
                children: schemaLevel,
            });
        } else {
            roots.push(...schemaLevel);
        }
    });

    return roots;
}

function collectCheckedIds(roots: ExplorerNode[]): Set<string> {
    const ids = new Set<string>();
    const walk = (nodes: ExplorerNode[]) => {
        for (const node of nodes) {
            if (node.checkProps.checked === true) ids.add(node.id);
            if (node.children) walk(node.children);
        }
    };
    walk(roots);
    return ids;
}

/**
 * Collapses a fully checked bound parent into that parent's include list and omits its leaves.
 * A named level with no matching property selects its child tables instead.
 * Pass checkedIds from the checkbox state. Falling back to checkProps keeps direct unit calls working,
 * but hidden nodes can keep a stale checkProps value after a search filter.
 */
export function extractExplorerSelections(
    roots: ExplorerNode[],
    checkedIds: Set<string> = collectCheckedIds(roots)
): SelectedDataListItem {
    const values: Record<string, string[]> = {};
    const schemas: string[] = [];
    const tables: string[] = [];

    const add = (propertyName: string | null, value: string, bucket: "schema" | "table") => {
        if (propertyName) pushUnique(values[propertyName] ??= [], value);
        pushUnique(bucket === "schema" ? schemas : tables, value);
    };

    const fullyChecked = (node: ExplorerNode): boolean => {
        if (!node.children?.length) return checkedIds.has(node.id);
        return node.children.every(fullyChecked);
    };

    const visit = (node: ExplorerNode) => {
        if (node.level !== "collection" && node.propertyName && fullyChecked(node)) {
            add(node.propertyName, node.selectionValue, "schema");
            return;
        }
        if (node.level === "collection") {
            if (checkedIds.has(node.id)) add(node.propertyName, node.fullyQualifiedName || node.selectionValue, "table");
            return;
        }
        node.children?.forEach(visit);
    };

    roots.forEach(visit);
    return { schemas, tables, values };
}

function sameMembers(a: string[] | undefined, b: string[] | undefined): boolean {
    const left = new Set(a ?? []);
    const right = new Set(b ?? []);
    if (left.size !== right.size) return false;
    for (const value of left) {
        if (!right.has(value)) return false;
    }
    return true;
}

export function selectionsEqual(
    a: SelectedDataListItem | undefined,
    b: SelectedDataListItem | undefined
): boolean {
    if (!sameMembers(a?.schemas, b?.schemas) || !sameMembers(a?.tables, b?.tables)) return false;
    const keys = new Set([...Object.keys(a?.values ?? {}), ...Object.keys(b?.values ?? {})]);
    for (const key of keys) {
        if (!sameMembers(a?.values?.[key], b?.values?.[key])) return false;
    }
    return true;
}
