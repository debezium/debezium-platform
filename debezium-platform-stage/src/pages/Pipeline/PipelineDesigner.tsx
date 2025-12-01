/* eslint-disable @typescript-eslint/no-unused-vars */
import * as React from "react";
import {
  ActionList,
  ActionListGroup,
  ActionListItem,
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
import { Destination, Source, Transform } from "../../apis/apis";
import CreationFlowTransform from "@components/pipelineDesigner/CreationFlowTransform";
import {
  DragDropSort,
  DragDropSortDragEndEvent,
  DraggableObject,
} from "@patternfly/react-drag-drop";
import { TrashIcon } from "@patternfly/react-icons";
import { ReactFlowProvider } from "reactflow";
import TrademarkMessage from "@components/TrademarkMessage";
import { useTranslation } from "react-i18next";

// Define Jotai atoms
export const selectedSourceAtom = atom<Source | undefined>(undefined);
export const selectedDestinationAtom = atom<Destination | undefined>(undefined);
export const selectedTransformAtom = atom<Transform[]>([]);

const getItems = (
  selectedTransform: Transform[],
  onTempDelete: (id: string) => void
): DraggableObject[] =>
  selectedTransform.map((transform, idx) => ({
    id: `${idx}-${transform.id}=${transform.name}`,
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
              onClick={() =>
                onTempDelete(`${idx}-${transform.id}=${transform.name}`)
              }
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
  const { t } = useTranslation();

  const [items, setItems] = React.useState<DraggableObject[]>([]);

  const [selectedSource, setSelectedSource] = useAtom(selectedSourceAtom);
  const [selectedDestination, setSelectedDestination] = useAtom(
    selectedDestinationAtom
  );
  const [selectedTransform, setSelectedTransform] = useAtom(
    selectedTransformAtom
  );

  const [isExpanded, setIsExpanded] = React.useState(false);
  const drawerRef = React.useRef<HTMLDivElement>(null);

  // Handle temporary deletion of items
  const handleTempDelete = React.useCallback((id: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  }, []);

  // Initialize items when selectedTransform changes
  React.useEffect(() => {
    if (selectedTransform.length > 0) {
      setItems(getItems(selectedTransform, handleTempDelete));
    }
  }, [selectedTransform, handleTempDelete]);

  const onExpand = () => {
    drawerRef.current && drawerRef.current.focus();
  };

  const onToggleDrawer = () => {
    if (isExpanded) {
      // Reset temporary state when closing drawer without applying
      setItems(getItems(selectedTransform, handleTempDelete));
    }
    setIsExpanded(!isExpanded);
  };

  const onCloseClick = () => {
    // Reset temporary state when closing drawer without applying
    setItems(getItems(selectedTransform, handleTempDelete));
    setIsExpanded(false);
  };

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
    (transforms: Transform[]) => {
      setSelectedTransform((prevTransforms) => [...prevTransforms, ...transforms]);
    },
    [setSelectedTransform]
  );

  const navigateTo = (url: string) => {
    navigate(url);
  };

  // Function to handle rearrange and delete apply button click
  const handleRearrangeClick = () => {
    const updatedTransforms = items.map((item) => {
      const [indexId, name] = String(item.id).split("=");
      const [_, id] = indexId.split("-");
      return { id: Number(id), name };
    });

    setSelectedTransform(...[updatedTransforms]);
    onToggleDrawer();
  };

  const reArrangeTransform = (
    _event: DragDropSortDragEndEvent,
    newItems: DraggableObject[],
    _oldIndex?: number | undefined,
    _newIndex?: number | undefined
  ) => {
    setItems(newItems);
  };

  const panelContent = (
    <DrawerPanelContent>
      <DrawerHead>
        <Content component="h4" tabIndex={isExpanded ? 0 : -1}>
          {t('pipeline:transformDrawer.title')}
        </Content>
        <DrawerActions>
          <DrawerCloseButton onClick={onCloseClick} />
        </DrawerActions>
      </DrawerHead>
      <DrawerPanelDescription>
        {t('pipeline:transformDrawer.description')}
      </DrawerPanelDescription>
      <DrawerPanelBody style={{ display: "inline-block" }}>
        {selectedTransform.length === 0 ? (
          <>{t('pipeline:transformDrawer.emptyState')}</>
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
              {t('apply')}
            </Button>
          </>
        )}
      </DrawerPanelBody>
    </DrawerPanelContent>
  );

  return (
    <>
      <TrademarkMessage />
      <Drawer isExpanded={isExpanded} onExpand={onExpand}>
        <DrawerContent panelContent={panelContent}>
          <DrawerContentBody>
            <PageSection className="pipeline_designer">
              <PageSection isWidthLimited style={{ gap: 0 }}>
                <Content component="h1">
                  {t('pipeline:pipelinePage.designerTitle')}
                </Content>
                <Content component="p">
                  {t('pipeline:pipelinePage.designerDescription')}
                </Content>
              </PageSection>
              <PageSection isFilled>
                <Card isFullHeight>
                  <CardBody isFilled style={{ padding: "15px" }}>
                    <ReactFlowProvider>
                      <CreationFlowTransform
                        updateSelectedSource={updateSelectedSource}
                        updateSelectedDestination={updateSelectedDestination}
                        onToggleDrawer={onToggleDrawer}
                        updateSelectedTransform={updateSelectedTransform}
                      />
                    </ReactFlowProvider>
                  </CardBody>

                  <CardFooter
                    className="custom-card-footer"
                  >
                    <ActionList>
                      <ActionListGroup >
                        <ActionListItem>
                          <Button
                            variant="primary"
                            isDisabled={
                              selectedDestination === undefined ||
                              selectedSource === undefined
                            }
                            onClick={() =>
                              navigateTo(
                                `/pipeline/pipeline_designer/create_pipeline?sourceId=${selectedSource?.id}&destinationId=${selectedDestination?.id}`
                              )
                            }
                          >
                            {t('pipeline:configuePipeline')}
                          </Button>
                        </ActionListItem>
                        <ActionListItem>
                          <Button
                            variant="link"
                            onClick={() => navigateTo("/pipeline")}
                          >
                            {t('cancel')}
                          </Button>
                        </ActionListItem>
                      </ActionListGroup>
                    </ActionList>

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
