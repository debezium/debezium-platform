/* eslint-disable @typescript-eslint/no-unused-vars */
import * as React from "react";
import {
  ActionGroup,
  Button,
  Card,
  CardBody,
  CardFooter,
  Content,
  DataList,
  DataListAction,
  DataListCell,
  DataListItemCells,
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  DrawerPanelDescription,
  PageSection,
  Tooltip,
} from "@patternfly/react-core";
import { atom, useAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import "./PipelineDesigner.css";
// import CreationFlow from "../../components/dataFlow/CreationFlow";
import { Destination, Source, Transform } from "../../apis/apis";
import CreationFlowTransform from "@components/dataFlow/CreationFlowTransform";
import {
  DragDropSort,
  DragDropSortDragEndEvent,
  DraggableObject,
} from "@patternfly/react-drag-drop";
import { TrashIcon } from "@patternfly/react-icons";

// Define Jotai atoms
export const selectedSourceAtom = atom<Source | undefined>(undefined);
export const selectedDestinationAtom = atom<Destination | undefined>(undefined);
export const selectedTransformAtom = atom<Transform[]>([]);

const getItems = (selectedTransform: Transform[]): DraggableObject[] =>
  selectedTransform.map((transform, idx) => ({
    id: `${transform.id}=${transform.name}`,
    content: (
      <>
        <DataListItemCells
          dataListCells={[
            <DataListCell key={`item-${idx}`} style={{ alignSelf: "center" }}>
              <Content component="p">{transform.name}</Content>
            </DataListCell>,
          ]}
        />
        <DataListAction
          aria-labelledby="single-action-item1 single-action-action1"
          id="single-action-action1"
          aria-label="Actions"
        >
          <Tooltip content="Delete">
            <Button
              onClick={() => {
                console.log("deleted clicked" + `data-list-item-${idx}`);
              }}
              variant="plain"
              key="delete-action"
              icon={<TrashIcon />}
            />
          </Tooltip>
        </DataListAction>
      </>
    ),
  }));

const PipelineDesigner: React.FunctionComponent = () => {
  const navigate = useNavigate();

  const [items, setItems] = React.useState<DraggableObject[]>([]);

  const [isSourceConfigured, setIsSourceConfigured] = React.useState(false);
  const [isDestinationConfigured, setIsDestinationConfigured] =
    React.useState(false);

  const [selectedSource, setSelectedSource] = useAtom(selectedSourceAtom);
  const [selectedDestination, setSelectedDestination] = useAtom(
    selectedDestinationAtom
  );
  const [selectedTransform, setSelectedTransform] = useAtom(
    selectedTransformAtom
  );

  const [rearrangeTrigger, setRearrangeTrigger] = React.useState(false);

  // Function to handle rearrange apply button click
  const handleRearrangeClick = () => {
    const updatedTransforms = items.map((item) => {
      const [id, name] = String(item.id).split("=");
      return { id: Number(id), name };
    });
    setSelectedTransform(updatedTransforms);

    setRearrangeTrigger((prev) => !prev); // Toggle to trigger rearrangement in child
    onToggleDrawer();
  };

  const [isExpanded, setIsExpanded] = React.useState(false);
  const drawerRef = React.useRef<HTMLDivElement>();

  React.useEffect(() => {
    selectedTransform.length > 0 && setItems(getItems(selectedTransform));
  }, [selectedTransform]);

  const onExpand = () => {
    drawerRef.current && drawerRef.current.focus();
  };

  const onToggleDrawer = () => {
    setIsExpanded(!isExpanded);
  };

  const onCloseClick = () => {
    setIsExpanded(false);
  };

  const updateIfSourceConfigured = React.useCallback(
    (isConfigured: boolean) => {
      setIsSourceConfigured(isConfigured);
    },
    []
  );

  const updateIfDestinationConfigured = React.useCallback(
    (isConfigured: boolean) => {
      setIsDestinationConfigured(isConfigured);
    },
    []
  );

  const updateSelectedSource = React.useCallback(
    (source: Source) => {
      setSelectedSource(source);
    },
    [setSelectedSource]
  );

  const updateSelectedDestination = React.useCallback(
    (destination: Destination) => {
      setSelectedDestination(destination);
    },
    [setSelectedDestination]
  );

  const updateSelectedTransform = React.useCallback(
    (transform: Transform) => {
      setSelectedTransform((prevTransforms) => [...prevTransforms, transform]);
    },
    [setSelectedTransform]
  );

  const navigateTo = (url: string) => {
    navigate(url);
  };

  React.useEffect(() => {
    setItems(getItems(selectedTransform));
  }, [selectedTransform]);

  const reArrangeTransform = (
    _event: DragDropSortDragEndEvent,
    newItems: DraggableObject[],
    oldIndex?: number | undefined,
    newIndex?: number | undefined
  ) => {
    setItems(newItems);
    console.log("newItems", newItems, oldIndex, newIndex);
    // const updatedTransforms = [...selectedTransform];
    // if (oldIndex !== undefined && newIndex !== undefined) {
    //   const [movedItem] = updatedTransforms.splice(oldIndex, 1);
    //   updatedTransforms.splice(newIndex, 0, movedItem);
    //   setSelectedTransform(updatedTransforms);
    // }
  };

  const panelContent = (
    <DrawerPanelContent>
      <DrawerHead>
        {/* <span tabIndex={isExpanded ? 0 : -1} ref={drawerRef}>
          Drawer panel header
        </span> */}
        <Content component="h4" tabIndex={isExpanded ? 0 : -1}>
          Transform list
        </Content>
        <DrawerActions>
          <DrawerCloseButton onClick={onCloseClick} />
        </DrawerActions>
      </DrawerHead>
      <DrawerPanelDescription>
        List of transform to be applied to pipeline you can delete or rearrange
        them on specific order for them to be applied.
      </DrawerPanelDescription>
      <DrawerPanelBody style={{ display: "inline-block" }}>
        {selectedTransform.length === 0 ? (
          <>No transform configured</>
        ) : (
          <>
            <DragDropSort
              items={items}
              onDrop={reArrangeTransform}
              variant="DataList"
              overlayProps={{ isCompact: true }}
            >
              <DataList aria-label="draggable data list example" isCompact />
            </DragDropSort>
            <Button
              variant="primary"
              style={{ marginTop: "15px" }}
              onClick={handleRearrangeClick}
            >
              Apply
            </Button>
          </>
        )}
      </DrawerPanelBody>
    </DrawerPanelContent>
  );

  return (
    <>
      <Drawer isExpanded={isExpanded} onExpand={onExpand}>
        <DrawerContent panelContent={panelContent}>
          <DrawerContentBody>
            <PageSection className="pipeline_designer">
              <PageSection isWidthLimited style={{ gap: 0 }}>
                <Content component="h1" onClick={onToggleDrawer}>
                  Pipeline designer
                </Content>
                <Content component="p">
                  Configure the pipeline by adding an existing source and
                  destination or create a new one as per you need. Optionally
                  you can also any number of transformation as needed.
                </Content>
              </PageSection>
              <PageSection isFilled>
                <Card isFullHeight>
                  <CardBody isFilled style={{ padding: "15px" }}>
                    <CreationFlowTransform
                      updateIfSourceConfigured={updateIfSourceConfigured}
                      updateIfDestinationConfigured={
                        updateIfDestinationConfigured
                      }
                      updateSelectedSource={updateSelectedSource}
                      updateSelectedDestination={updateSelectedDestination}
                      onToggleDrawer={onToggleDrawer}
                      updateSelectedTransform={updateSelectedTransform}
                      selectedTransform={selectedTransform}
                      isDestinationConfigured={isDestinationConfigured}
                      rearrangeTrigger={rearrangeTrigger}
                    />
                  </CardBody>

                  <CardFooter
                    className="custom-card-footer"
                    style={{ padding: 0 }}
                  >
                    <ActionGroup className="create_pipeline-footer">
                      <Button
                        variant="primary"
                        isDisabled={
                          !(isSourceConfigured && isDestinationConfigured)
                        }
                        onClick={() =>
                          navigateTo(
                            `/pipeline/pipeline_designer/create_pipeline?sourceId=${selectedSource?.id}&destinationId=${selectedDestination?.id}`
                          )
                        }
                      >
                        Configure Pipeline
                      </Button>
                      <Button
                        variant="link"
                        onClick={() => navigateTo("/pipeline")}
                      >
                        Cancel
                      </Button>
                    </ActionGroup>
                  </CardFooter>
                </Card>
              </PageSection>
            </PageSection>
          </DrawerContentBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export { PipelineDesigner };
