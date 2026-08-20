import * as React from "react";
import {
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  ToolbarFilter,
} from "@patternfly/react-core";

interface SingleSelectFilterProps<T extends string> {
  label: string;
  options: T[];
  selected: T | undefined;
  onChange: (next: T | undefined) => void;
  getLabel?: (value: T) => string;
  showToolbarItem?: boolean;
  /** When false, render a plain select with no filter chip or clear control. */
  showToolbarFilter?: boolean;
  /** Optional first option that clears the selection (e.g. "All types"). */
  allOption?: string;
}

const ALL_OPTION_VALUE = "__all__";

export function SingleSelectFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
  getLabel = (value) => value,
  showToolbarItem = true,
  showToolbarFilter = true,
  allOption,
}: SingleSelectFilterProps<T>) {
  const [isOpen, setIsOpen] = React.useState(false);

  const onToggleClick = () => {
    setIsOpen(!isOpen);
  };

  const onSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => {
    if (value === ALL_OPTION_VALUE) {
      onChange(undefined);
    } else {
      const next = value as T;
      onChange(!showToolbarFilter && !allOption && next === selected ? undefined : next);
    }
    setIsOpen(false);
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      onClick={onToggleClick}
      isExpanded={isOpen}
      className="filter_select"
    >
      {label}
    </MenuToggle>
  );

  const select = (
    <Select
      id={`${label.toLowerCase()}-select`}
      isOpen={isOpen}
      selected={selected ?? (allOption ? ALL_OPTION_VALUE : undefined)}
      onSelect={onSelect}
      onOpenChange={(nextOpen: boolean) => setIsOpen(nextOpen)}
      toggle={toggle}
      shouldFocusToggleOnSelect
    >
      <SelectList>
        {allOption && (
          <SelectOption value={ALL_OPTION_VALUE} isSelected={selected === undefined}>
            {allOption}
          </SelectOption>
        )}
        {options.map((option) => (
          <SelectOption key={option} value={option} isSelected={selected === option}>
            {getLabel(option)}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );

  if (!showToolbarFilter) {
    return select;
  }

  return (
    <ToolbarFilter
      labels={selected ? [{ key: selected, node: getLabel(selected) }] : []}
      deleteLabel={() => onChange(undefined)}
      deleteLabelGroup={() => onChange(undefined)}
      categoryName={label}
      showToolbarItem={showToolbarItem}
    >
      {select}
    </ToolbarFilter>
  );
}
