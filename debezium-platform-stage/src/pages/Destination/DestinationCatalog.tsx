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

const DestinationCatalog: React.FunctionComponent<ISinkProps> = () => {
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

  const onDestinationSelection = (destinationId: string) => {
    navigate(`/destination/create_destination/${destinationId}`);
  };

  return (
    <>
      <PageSection isWidthLimited>
        <Content component="h1">Destination</Content>
        <Content component="p">
          Add a destination to capture the change data event. To start select a
          connector below once you select a connector you can configure it using
          form or smart editor option. You can also search the connector by its
          name or toggle the catalog between the list view or card view.
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
            <ToolbarGroup align={{ default: "alignEnd" }}>
              <ToolbarItem>
                <Content component={ContentVariants.small}>12 Items</Content>
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </PageSection>
      <CatalogGrid
        onCardSelect={onDestinationSelection}
        catalogType="destination"
        isAddButtonVisible={true}
      />
    </>
  );
};

export { DestinationCatalog };
