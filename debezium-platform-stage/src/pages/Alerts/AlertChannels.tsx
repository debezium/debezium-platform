import * as React from "react";
import {
  Bullseye,
  Button,
  Card,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateVariant,
  Form,
  FormGroup,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageSection,
  TextInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import {
  ActionsColumn,
  IAction,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@patternfly/react-table";
import { OutlinedBellIcon, PlusIcon } from "@patternfly/react-icons";
import PageHeader from "@components/PageHeader";
import { useNotification } from "../../appLayout/AppNotificationContext";
import {
  EmailChannelConfig,
  NotificationChannel,
  WebhookChannelConfig,
} from "./alertsTypes";
import AlertChannelFormModal from "./AlertChannelFormModal";

interface AlertChannelsProps {
  channels: NotificationChannel[];
  setChannels: React.Dispatch<React.SetStateAction<NotificationChannel[]>>;
}

const describeChannel = (channel: NotificationChannel): string => {
  if (channel.type === "EMAIL") {
    const config = channel.config as EmailChannelConfig;
    const [first, ...rest] = config.recipients;
    return rest.length > 0 ? `${first} (+${rest.length})` : first ?? "-";
  }
  const config = channel.config as WebhookChannelConfig;
  return config.url.length > 42 ? `${config.url.slice(0, 42)}...` : config.url;
};

const AlertChannels: React.FC<AlertChannelsProps> = ({ channels, setChannels }) => {
  const { addNotification } = useNotification();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingChannel, setEditingChannel] = React.useState<NotificationChannel | undefined>(
    undefined
  );
  const [deleteTarget, setDeleteTarget] = React.useState<NotificationChannel | undefined>(
    undefined
  );
  const [deleteConfirmName, setDeleteConfirmName] = React.useState("");
  const [testingId, setTestingId] = React.useState<number | undefined>(undefined);

  const openCreateForm = () => {
    setEditingChannel(undefined);
    setIsFormOpen(true);
  };

  const openEditForm = (channel: NotificationChannel) => {
    setEditingChannel(channel);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingChannel(undefined);
  };

  const handleSaveChannel = (channel: NotificationChannel) => {
    setChannels((prev) => {
      const exists = prev.some((c) => c.id === channel.id);
      return exists ? prev.map((c) => (c.id === channel.id ? channel : c)) : [channel, ...prev];
    });
    closeForm();
  };

  const requestDelete = (channel: NotificationChannel) => {
    setDeleteTarget(channel);
    setDeleteConfirmName("");
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setChannels((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(undefined);
  };

  // POC stand-in for POST /api/alerts/channels/{id}/test - there is no backend to reach yet,
  // so this simulates network latency and always reports success.
  const handleTest = async (channel: NotificationChannel) => {
    setTestingId(channel.id);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setTestingId(undefined);
    addNotification(
      "success",
      "Test notification sent successfully",
      `A sample payload was sent to "${channel.name}".`
    );
  };

  const rowActions = (channel: NotificationChannel): IAction[] => [
    { title: "Edit", onClick: () => openEditForm(channel) },
    { title: "Delete", onClick: () => requestDelete(channel) },
  ];

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
      {channels.length > 0 ? (
        <>
          <PageHeader
            title="Notification Channels"
            description="Named, reusable delivery targets for alert rules. One channel can serve multiple rules, and a rule can notify through multiple channels."
          />
          <PageSection>
            <Card>
              <Toolbar id="alert-channels-toolbar-sticky" className="alerts-custom-toolbar" isSticky>
                <ToolbarContent>
                  <ToolbarItem>
                    <Button variant="primary" icon={<PlusIcon />} onClick={openCreateForm}>
                      Create channel
                    </Button>
                  </ToolbarItem>
                  <ToolbarItem align={{ default: "alignEnd" }}>
                    <Content component={ContentVariants.small}>{channels.length} items</Content>
                  </ToolbarItem>
                </ToolbarContent>
              </Toolbar>

              <Table aria-label="Notification channels table">
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Type</Th>
                    <Th>Details</Th>
                    <Th>Status</Th>
                    <Th screenReaderText="Actions" />
                  </Tr>
                </Thead>
                <Tbody>
                  {channels.map((channel) => (
                    <Tr key={channel.id}>
                      <Td dataLabel="Name">{channel.name}</Td>
                      <Td dataLabel="Type">
                        {channel.type === "EMAIL" ? "Email" : "Webhook"}
                      </Td>
                      <Td dataLabel="Details">{describeChannel(channel)}</Td>
                      <Td dataLabel="Status">
                        <Label color={channel.enabled ? "green" : "grey"} isCompact>
                          {channel.enabled ? "Enabled" : "Disabled"}
                        </Label>
                      </Td>
                      <Td dataLabel="Actions" isActionCell>
                        <Button
                          variant="secondary"
                          size="sm"
                          isLoading={testingId === channel.id}
                          isDisabled={testingId === channel.id}
                          onClick={() => handleTest(channel)}
                          style={{ marginRight: 8 }}
                        >
                          Test
                        </Button>
                        <ActionsColumn items={rowActions(channel)} />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Card>
          </PageSection>
        </>
      ) : (
        <PageSection style={{ position: "relative", minHeight: "100%" }} isFilled>
          <Bullseye>
            <EmptyState
              variant={EmptyStateVariant.lg}
              titleText="No notification channels yet"
              headingLevel="h4"
              icon={OutlinedBellIcon}
            >
              <EmptyStateBody>
                Alerts always appear in the platform UI. Add an email or webhook channel to also
                notify your team externally.
              </EmptyStateBody>
              <EmptyStateFooter>
                <Button variant="primary" icon={<PlusIcon />} onClick={openCreateForm}>
                  Create channel
                </Button>
              </EmptyStateFooter>
            </EmptyState>
          </Bullseye>
        </PageSection>
      )}

      {isFormOpen && (
        <AlertChannelFormModal
          isOpen={isFormOpen}
          channel={editingChannel}
          existingChannels={channels}
          onClose={closeForm}
          onSave={handleSaveChannel}
        />
      )}

      <Modal
        variant="small"
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(undefined)}
        aria-labelledby="delete-channel-modal-title"
      >
        <ModalHeader
          title={<p>Delete channel &quot;{deleteTarget?.name}&quot;?</p>}
          titleIconVariant="warning"
          labelId="delete-channel-modal-title"
        />
        <ModalBody>
          <Content component="p">
            Rules using this channel will keep evaluating, but will stop notifying through it.
            Type the channel name to confirm.
          </Content>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              if (deleteTarget && deleteConfirmName === deleteTarget.name) confirmDelete();
            }}
          >
            <FormGroup isRequired fieldId="delete-channel-name">
              <TextInput
                id="delete-channel-name"
                aria-label="delete channel name"
                value={deleteConfirmName}
                onChange={(_e, value) => setDeleteConfirmName(value)}
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="danger"
            isDisabled={deleteConfirmName !== deleteTarget?.name}
            onClick={confirmDelete}
          >
            Delete
          </Button>
          <Button variant="link" onClick={() => setDeleteTarget(undefined)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default AlertChannels;
