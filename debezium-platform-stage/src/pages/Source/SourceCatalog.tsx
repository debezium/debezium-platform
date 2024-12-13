/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  Content,
  ContentVariants,
  PageSection,
  SearchInput,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import { ListIcon, ThIcon } from "@patternfly/react-icons";
import { useNavigate } from "react-router-dom";
import { CatalogGrid } from "@components/CatalogGrid";

export interface ISinkProps {
  sampleProp?: string;
}

const SourceCatalog: React.FunctionComponent<ISinkProps> = () => {
  const navigate = useNavigate();

  const [isSelected, setIsSelected] = React.useState("toggle-group-icons-1");

  const handleItemClick = (
    event:
      | MouseEvent
      | React.MouseEvent<any, MouseEvent>
      | React.KeyboardEvent<Element>
  ) => {
    const id = event.currentTarget.id;
    setIsSelected(id);
  };

  const onSourceSelection = (sourceId: string) => {
    navigate(`/source/create_source/${sourceId}`);
  };

  return (
    <>
      <PageSection isWidthLimited>
        <Content component="h1">Source catalog</Content>
        <Content component="p">
          Select the type of source you want to connect from the list below,
          once you select a connector you can configure it using form or smart
          editor option. You can also search the connector by its name or toggle
          the catalog between the list view or card view.
        </Content>
        <Toolbar
          id="toolbar-sticky"
          inset={{ default: "insetNone" }}
          className="custom-toolbar"
          isSticky
        >
          <ToolbarContent>
            <ToolbarItem>
              <SearchInput aria-label="Items example search input" />
            </ToolbarItem>
            <ToolbarItem>
              <ToggleGroup aria-label="Icon variant toggle group">
                <ToggleGroupItem
                  icon={<ThIcon />}
                  aria-label="copy"
                  buttonId="toggle-group-icons-1"
                  isSelected={isSelected === "toggle-group-icons-1"}
                  onChange={handleItemClick}
                />

                <ToggleGroupItem
                  icon={<ListIcon />}
                  aria-label="share square"
                  buttonId="toggle-group-icons-3"
                  isSelected={isSelected === "toggle-group-icons-3"}
                  onChange={handleItemClick}
                />
              </ToggleGroup>
            </ToolbarItem>
            {/* <ToolbarItem variant="separator" /> */}
            <ToolbarGroup align={{ default: "alignEnd" }}>
              <ToolbarItem>
                <Content component={ContentVariants.small}>12 Items</Content>
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </PageSection>

      <CatalogGrid
        onCardSelect={onSourceSelection}
        catalogType="source"
        isAddButtonVisible={true}
      />
    </>
  );
};

export { SourceCatalog };
