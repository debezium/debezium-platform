import * as React from "react";
import {
  Bullseye,
  Button,
  Card,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateVariant,
  Form,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageSection,
  Spinner,
  Switch,
  TextInput,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  Tooltip,
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
import { ExclamationCircleIcon, OutlinedBellIcon, PlusIcon, SearchIcon } from "@patternfly/react-icons";
import { useQueryClient } from "react-query";
import PageHeader from "@components/PageHeader";
import { useNotification } from "../../appLayout/AppNotificationContext";
import {
  ALERT_CHANNELS_QUERY_KEY,
  createAlertChannel,
  deleteAlertChannel,
  fetchAlertChannels,
  testAlertChannel,
  updateAlertChannel,
} from "../../apis/alerts";
import { useResourceQuery } from "../../hooks/useResourceQuery";
import {
  EmailChannelConfig,
  NotificationChannel,
  NotificationChannelRequest,
  NotificationChannelType,
  WebhookChannelConfig,
} from "./alertsTypes";
import AlertChannelFormModal from "./AlertChannelFormModal";
import { SingleSelectFilter } from "./alertsFilters";
import "./AlertEvents.css";

const WEBHOOK_URL_DISPLAY_MAX = 42;

const describeChannel = (channel: NotificationChannel): string => {
  if (channel.type === "EMAIL") {
    const config = channel.config as EmailChannelConfig;
    const [first, ...rest] = config.recipients ?? [];
    return rest.length > 0 ? `${first} (+${rest.length})` : first ?? "-";
  }
  const config = channel.config as WebhookChannelConfig;
  if (!config.url) return "-";
  return config.url.length > WEBHOOK_URL_DISPLAY_MAX
    ? `${config.url.slice(0, WEBHOOK_URL_DISPLAY_MAX)}...`
    : config.url;
};

const ChannelDetails: React.FC<{ channel: NotificationChannel }> = ({ channel }) => {
  const summary = describeChannel(channel);
  let tooltip: React.ReactNode | undefined;

  if (channel.type === "EMAIL") {
    const recipients = (channel.config as EmailChannelConfig).recipients ?? [];
    if (recipients.length > 1) {
      tooltip = (
        <div>
          {recipients.map((email) => (
            <div key={email}>{email}</div>
          ))}
        </div>
      );
    }
  } else {
    const url = (channel.config as WebhookChannelConfig).url ?? "";
    if (url.length > WEBHOOK_URL_DISPLAY_MAX) {
      tooltip = url;
    }
  }

  if (!tooltip) {
    return <>{summary}</>;
  }

  return (
    <Tooltip content={tooltip}>
      <span tabIndex={0}>{summary}</span>
    </Tooltip>
  );
};

const AlertChannels: React.FC = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotification();

  const {
    data: channels = [],
    isLoading,
    isError,
  } = useResourceQuery<NotificationChannel[], Error>(ALERT_CHANNELS_QUERY_KEY, fetchAlertChannels);

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingChannel, setEditingChannel] = React.useState<NotificationChannel | undefined>(
    undefined
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<NotificationChannel | undefined>(
    undefined
  );
  const [deleteConfirmName, setDeleteConfirmName] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [testingId, setTestingId] = React.useState<number | undefined>(undefined);
  const [togglingChannelId, setTogglingChannelId] = React.useState<number | undefined>(undefined);
  const [typeFilter, setTypeFilter] = React.useState<NotificationChannelType | undefined>(undefined);

  const displayedChannels = React.useMemo(
    () => (typeFilter ? channels.filter((channel) => channel.type === typeFilter) : channels),
    [channels, typeFilter]
  );

  const refreshChannels = () => queryClient.invalidateQueries(ALERT_CHANNELS_QUERY_KEY);

  const openCreateForm = () => {
    setEditingChannel(undefined);
    setIsFormOpen(true);
  };

  const openEditForm = (channel: NotificationChannel) => {
    setEditingChannel(channel);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingChannel(undefined);
  };

  const handleSaveChannel = async (payload: NotificationChannelRequest) => {
    setIsSaving(true);
    const response = editingChannel
      ? await updateAlertChannel(editingChannel.id, payload)
      : await createAlertChannel(payload);

    if (response.error) {
      addNotification(
        "danger",
        editingChannel ? "Edit failed" : "Create failed",
        `Failed to ${editingChannel ? "update" : "create"} "${payload.name}": ${response.error}`
      );
    } else {
      addNotification(
        "success",
        editingChannel ? "Save successful" : "Create successful",
        `Channel "${payload.name}" ${editingChannel ? "updated" : "created"} successfully.`
      );
      await refreshChannels();
      setIsFormOpen(false);
      setEditingChannel(undefined);
    }
    setIsSaving(false);
  };

  const requestDelete = (channel: NotificationChannel) => {
    setDeleteTarget(channel);
    setDeleteConfirmName("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAlertChannel(deleteTarget.id);
      addNotification(
        "success",
        "Delete successful",
        `Channel "${deleteTarget.name}" deleted successfully.`
      );
      await refreshChannels();
      setDeleteTarget(undefined);
    } catch (error) {
      addNotification(
        "danger",
        "Delete failed",
        error instanceof Error ? error.message : `Failed to delete "${deleteTarget.name}".`
      );
    }
    setIsDeleting(false);
  };

  const handleTest = async (channel: NotificationChannel) => {
    setTestingId(channel.id);
    const response = await testAlertChannel(channel.id);
    if (response.error || response.data?.success === false) {
      addNotification(
        "danger",
        "Test failed",
        response.error ?? response.data?.message ?? `Failed to send a test to "${channel.name}".`
      );
    } else {
      addNotification(
        "success",
        "Test notification sent successfully",
        response.data?.message ?? `A sample payload was sent to "${channel.name}".`
      );
    }
    setTestingId(undefined);
  };

  const toggleEnabled = async (channel: NotificationChannel) => {
    if (togglingChannelId !== undefined) return;
    const nextEnabled = !channel.enabled;
    setTogglingChannelId(channel.id);
    const response = await updateAlertChannel(channel.id, {
      name: channel.name,
      type: channel.type,
      config: channel.config,
      enabled: nextEnabled,
    });
    if (response.error) {
      addNotification(
        "danger",
        nextEnabled ? "Enable failed" : "Disable failed",
        `Failed to ${nextEnabled ? "enable" : "disable"} "${channel.name}": ${response.error}`
      );
    } else {
      await refreshChannels();
    }
    setTogglingChannelId(undefined);
  };

  const rowActions = (channel: NotificationChannel): IAction[] => [
  
    {
      title: "Test",
      onClick: () => {
        void handleTest(channel);
      },
      isDisabled: testingId === channel.id,
    },
      {
      title: channel.enabled ? "Disable" : "Enable",
      onClick: () => {
        void toggleEnabled(channel);
      },
    },
     { isSeparator: true },
    { title: "Edit", onClick: () => openEditForm(channel) },
    { title: "Delete", onClick: () => requestDelete(channel) },
  ];

  if (isLoading) {
    return (
      <PageSection isFilled>
        <Bullseye>
          <Spinner size="lg" aria-label="Loading notification channels" />
        </Bullseye>
      </PageSection>
    );
  }

  if (isError) {
    return (
      <PageSection isFilled>
        <Bullseye>
          <EmptyState
            variant={EmptyStateVariant.lg}
            titleText="Failed to load notification channels"
            headingLevel="h4"
            icon={ExclamationCircleIcon}
          >
            <EmptyStateBody>Check your connection and try again.</EmptyStateBody>
          </EmptyState>
        </Bullseye>
      </PageSection>
    );
  }

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
      {channels.length > 0 ? (
        <>
          <PageHeader
            title="Notification Channels"
            description="Named, reusable delivery targets for alert rules. One channel can serve multiple rules, and a rule can notify through multiple channels."
          />
          <PageSection>
            <Card className="pipeline-card">
              <Toolbar id="alert-channels-toolbar-sticky" className="custom-toolbar" isSticky>
                <ToolbarContent>
                  <ToolbarGroup variant="filter-group">
                    <ToolbarItem>
                      <SingleSelectFilter
                        label="Filter by type"
                        options={["EMAIL", "WEBHOOK"] as NotificationChannelType[]}
                        selected={typeFilter}
                        onChange={setTypeFilter}
                        getLabel={(value) => (value === "EMAIL" ? "Email" : "Webhook")}
                        showToolbarFilter={false}
                        allOption="All types"
                      />
                    </ToolbarItem>
                  </ToolbarGroup>
                  <ToolbarItem>
                    <Button variant="primary" icon={<PlusIcon />} onClick={openCreateForm}>
                      Add channel
                    </Button>
                  </ToolbarItem>
                  <ToolbarItem align={{ default: "alignEnd" }}>
                    <Content component={ContentVariants.small}>
                      {typeFilter
                        ? `${displayedChannels.length} of ${channels.length} items`
                        : `${channels.length} items`}
                    </Content>
                  </ToolbarItem>
                </ToolbarContent>
              </Toolbar>

              <Table aria-label="Notification channels table">
                <Thead>
                  <Tr>
                    <Th key={0}>Name</Th>
                    <Th key={1}>Type</Th>
                    <Th key={2}>Details</Th>
                    <Th key={3}>Status</Th>
             
                    <Th key={5} screenReaderText="Action" />
                  </Tr>
                </Thead>
                <Tbody>
                  {displayedChannels.length > 0 ? (
                    displayedChannels.map((channel) => (
                    <Tr key={channel.id}>
                      <Td dataLabel="Name">
                        <Button variant="link" isInline onClick={() => openEditForm(channel)}>
                          {channel.name}
                        </Button>
                      </Td>
                      <Td dataLabel="Type">
                        {channel.type === "EMAIL" ? "Email" : "Webhook"}
                      </Td>
                      <Td dataLabel="Details">
                        <ChannelDetails channel={channel} />
                      </Td>
                      <Td dataLabel="Status">
                        <Switch
                          id={`channel-enabled-${channel.id}`}
                          aria-label={`Enable ${channel.name}`}
                          isChecked={channel.enabled}
                          isDisabled={togglingChannelId === channel.id}
                          onChange={() => {
                            void toggleEnabled(channel);
                          }}
                          label={channel.enabled ? "On" : "Off"}
                        />
                      </Td>
                      <Td>
                        <ActionsColumn items={rowActions(channel)} />
                      </Td>
                    </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan={5}>
                        <Bullseye>
                          <EmptyState
                            headingLevel="h2"
                            titleText="No matching channel is present."
                            icon={SearchIcon}
                            variant={EmptyStateVariant.sm}
                          >
                            <EmptyStateBody>Clear the type filter and try again.</EmptyStateBody>
                            <EmptyStateFooter>
                              <EmptyStateActions>
                                <Button variant="link" onClick={() => setTypeFilter(undefined)}>
                                  Clear filter
                                </Button>
                              </EmptyStateActions>
                            </EmptyStateFooter>
                          </EmptyState>
                        </Bullseye>
                      </Td>
                    </Tr>
                  )}
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
          isSaving={isSaving}
          onClose={closeForm}
          onSave={(payload) => {
            void handleSaveChannel(payload);
          }}
        />
      )}

      <Modal
        variant="small"
        isOpen={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(undefined)}
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
              if (deleteTarget && deleteConfirmName === deleteTarget.name) void confirmDelete();
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
            isDisabled={deleteConfirmName !== deleteTarget?.name || isDeleting}
            isLoading={isDeleting}
            onClick={() => {
              void confirmDelete();
            }}
          >
            Delete
          </Button>
          <Button
            variant="link"
            isDisabled={isDeleting}
            onClick={() => setDeleteTarget(undefined)}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default AlertChannels;
