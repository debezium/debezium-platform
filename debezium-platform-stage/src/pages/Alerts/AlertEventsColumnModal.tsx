import * as React from "react";
import {
  Button,
  Content,
  DataList,
  DataListCell,
  DataListCheck,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@patternfly/react-core";
import {
  ALERT_EVENT_COLUMNS,
  AlertEventColumnId,
} from "./alertEventColumns";

interface AlertEventsColumnModalProps {
  isOpen: boolean;
  visibleColumnIds: ReadonlySet<AlertEventColumnId>;
  onClose: () => void;
  onSave: (columnIds: AlertEventColumnId[]) => void;
}

const AlertEventsColumnModal: React.FC<AlertEventsColumnModalProps> = ({
  isOpen,
  visibleColumnIds,
  onClose,
  onSave,
}) => {
  const [checkedState, setCheckedState] = React.useState<Record<AlertEventColumnId, boolean>>(() =>
    Object.fromEntries(
      ALERT_EVENT_COLUMNS.map((column) => [column.id, visibleColumnIds.has(column.id)])
    ) as Record<AlertEventColumnId, boolean>
  );

  const selectedCount = ALERT_EVENT_COLUMNS.filter((column) => checkedState[column.id]).length;
  const canSave = selectedCount > 0;

  const handleChange = (columnId: AlertEventColumnId, checked: boolean) => {
    setCheckedState((prev) => ({ ...prev, [columnId]: checked }));
  };

  const selectAllColumns = () => {
    setCheckedState(
      Object.fromEntries(ALERT_EVENT_COLUMNS.map((column) => [column.id, true])) as Record<
        AlertEventColumnId,
        boolean
      >
    );
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave(ALERT_EVENT_COLUMNS.filter((column) => checkedState[column.id]).map((column) => column.id));
  };

  return (
    <Modal
      variant="small"
      isOpen={isOpen}
      onClose={onClose}
      aria-labelledby="alert-events-column-management-title"
      aria-describedby="alert-events-column-management-description"
    >
      <ModalHeader
        title="Manage columns"
        labelId="alert-events-column-management-title"
        descriptorId="alert-events-column-management-description"
        description={
          <Content id="alert-events-column-management-description">
            <Content component="p">Selected columns will be displayed in the table.</Content>
            <Button isInline variant="link" onClick={selectAllColumns}>
              Select all
            </Button>
          </Content>
        }
      />
      <ModalBody>
        <DataList aria-label="Alert event columns" id="alert-events-column-management" isCompact>
          {ALERT_EVENT_COLUMNS.map((column) => {
            const labelId = `alert-events-column-${column.id}`;
            const checkId = `alert-events-column-check-${column.id}`;
            return (
              <DataListItem key={column.id} aria-labelledby={labelId}>
                <DataListItemRow>
                  <DataListCheck
                    aria-labelledby={labelId}
                    isChecked={checkedState[column.id]}
                    id={checkId}
                    onChange={(_event, checked) => handleChange(column.id, checked)}
                  />
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell id={labelId} key={column.id}>
                        <label htmlFor={checkId}>{column.label}</label>
                      </DataListCell>,
                    ]}
                  />
                </DataListItemRow>
              </DataListItem>
            );
          })}
        </DataList>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" isDisabled={!canSave} onClick={handleSave}>
          Save
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default AlertEventsColumnModal;
