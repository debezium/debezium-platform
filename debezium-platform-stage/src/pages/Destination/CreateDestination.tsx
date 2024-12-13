/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  ActionGroup,
  Button,
  ButtonType,
  FormContextProvider,
  PageSection,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import { PencilAltIcon, CodeIcon } from "@patternfly/react-icons";
import destinationCatalog from "../../__mocks__/data/DestinationCatalog.json";
import { useNavigate, useParams } from "react-router-dom";
import "./CreateDestination.css";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { find } from "lodash";
import { createPost, Destination } from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { convertMapToObject } from "../../utils/helpers";
import { useNotification } from "../../appLayout/AppNotificationContext";
import PageHeader from "@components/PageHeader";
import SourceSinkForm from "@components/SourceSinkForm";
import { useState } from "react";

interface CreateDestinationProps {
  modelLoaded?: boolean;
  selectedId?: string;
  selectDestination?: (destinationId: string) => void;
  onSelection?: (selection: Destination) => void;
}

type Properties = { key: string; value: string };

const CreateDestination: React.FunctionComponent<CreateDestinationProps> = ({
  modelLoaded,
  selectedId,
  selectDestination,
  onSelection,
}) => {
  const navigate = useNavigate();
  const destinationIdParam = useParams<{ destinationId: string }>();
  const destinationIdModel = selectedId;
  const destinationId = modelLoaded
    ? destinationIdModel
    : destinationIdParam.destinationId;

  const navigateTo = (url: string) => {
    navigate(url);
  };

  const { addNotification } = useNotification();

  const [errorWarning, setErrorWarning] = useState<string[]>([]);

  const [editorSelected, setEditorSelected] = React.useState("form-editor");

  const [isLoading, setIsLoading] = React.useState(false);

  const [properties, setProperties] = useState<Map<string, Properties>>(
    new Map([["key0", { key: "", value: "" }]])
  );
  const [keyCount, setKeyCount] = React.useState<number>(1);

  const handleAddProperty = () => {
    const newKey = `key${keyCount}`;
    setProperties(
      (prevProperties) =>
        new Map(prevProperties.set(newKey, { key: "", value: "" }))
    );
    setKeyCount((prevCount) => prevCount + 1);
  };

  const handleDeleteProperty = (key: string) => {
    setProperties((prevProperties) => {
      const newProperties = new Map(prevProperties);
      newProperties.delete(key);
      return newProperties;
    });
  };

  const handlePropertyChange = (
    key: string,
    type: "key" | "value",
    newValue: string
  ) => {
    setProperties((prevProperties) => {
      const newProperties = new Map(prevProperties);
      const property = newProperties.get(key);
      if (property) {
        if (type === "key") property.key = newValue;
        else if (type === "value") property.value = newValue;
        newProperties.set(key, property);
      }
      return newProperties;
    });
  };

  const createNewDestination = async (values: Record<string, string>) => {
    const payload = {
      description: values["details"],
      type: find(destinationCatalog, { id: destinationId })?.type || "",
      schema: "schema321",
      vaults: [],
      config: convertMapToObject(properties),
      name: values["destination-name"],
    };

    const response = await createPost(`${API_URL}/api/destinations`, payload);

    if (response.error) {
      addNotification(
        "danger",
        `Destination creation failed`,
        `Failed to create ${(response.data as Destination).name}: ${
          response.error
        }`
      );
    } else {
      modelLoaded && onSelection && onSelection(response.data as Destination);
      addNotification(
        "success",
        `Create successful`,
        `Destination "${
          (response.data as Destination).name
        }" created successfully.`
      );
    }
  };

  const handleCreateDestination = async (values: Record<string, string>) => {
    setIsLoading(true);
    const errorWarning = [] as string[];
    properties.forEach((value: Properties, key: string) => {
      if (value.key === "" || value.value === "") {
        errorWarning.push(key);
      }
    });
    setErrorWarning(errorWarning);
    if (errorWarning.length > 0) {
      addNotification(
        "danger",
        `Destination creation failed`,
        `Please fill both Key and Value fields for all the properties.`
      );
      setIsLoading(false);
      return;
    }
    await createNewDestination(values);
    setIsLoading(false);
    !modelLoaded && navigateTo("/destination");
  };

  const handleItemClick = (
    event:
      | MouseEvent
      | React.MouseEvent<any, MouseEvent>
      | React.KeyboardEvent<Element>
  ) => {
    const id = event.currentTarget.id;
    setEditorSelected(id);
  };

  return (
    <>
      {!modelLoaded && (
        <PageHeader
          title="Create Destination"
          description="To configure and create a connector fill out the below form or use
            the smart editor to setup a new destination connector. If you
            already have a configuration file, you can setup a new destination
            connector by uploading it in the smart editor."
        />
      )}

      <PageSection className="create_destination-toolbar">
        <Toolbar id="create-editor-toggle">
          <ToolbarContent>
            <ToolbarItem>
              <ToggleGroup aria-label="Toggle between form and smart editor">
                <ToggleGroupItem
                  icon={<PencilAltIcon />}
                  text="Form editor"
                  aria-label="Form editor"
                  buttonId="form-editor"
                  isSelected={editorSelected === "form-editor"}
                  onChange={handleItemClick}
                />

                <ToggleGroupItem
                  icon={<CodeIcon />}
                  text="Smart editor"
                  aria-label="Smart editor"
                  buttonId="smart-editor"
                  isSelected={editorSelected === "smart-editor"}
                  onChange={handleItemClick}
                />
              </ToggleGroup>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      </PageSection>
      <FormContextProvider initialValues={{}}>
        {({ setValue, getValue, setError, values, errors }) => (
          <>
            <PageSection
              isWidthLimited={
                (modelLoaded && editorSelected === "form-editor") ||
                !modelLoaded
              }
              isCenterAligned
              isFilled
              className={
                editorSelected === "form-editor"
                  ? "custom-page-section create_destination-page_section"
                  : "create_destination-page_section"
              }
            >
              {editorSelected === "form-editor" ? (
                <SourceSinkForm
                  ConnectorId={destinationId || ""}
                  connectorType="destination"
                  properties={properties}
                  setValue={setValue}
                  getValue={getValue}
                  setError={setError}
                  errors={errors}
                  errorWarning={errorWarning}
                  handleAddProperty={handleAddProperty}
                  handleDeleteProperty={handleDeleteProperty}
                  handlePropertyChange={handlePropertyChange}
                />
              ) : (
                <CodeEditor
                  isUploadEnabled
                  isDownloadEnabled
                  isCopyEnabled
                  isLanguageLabelVisible
                  isMinimapVisible
                  language={Language.yaml}
                  height="450px"
                />
              )}
            </PageSection>
            <PageSection className="pf-m-sticky-bottom" isFilled={false}>
              <ActionGroup className="create_destination-footer">
                <Button
                  variant="primary"
                  isLoading={isLoading}
                  isDisabled={isLoading}
                  type={ButtonType.submit}
                  onClick={(e) => {
                    e.preventDefault();

                    if (!values["destination-name"]) {
                      setError(
                        "destination-name",
                        "Destination name is required."
                      );
                    } else {
                      handleCreateDestination(values);
                    }
                  }}
                >
                  Create destination
                </Button>
                {modelLoaded ? (
                  <Button
                    variant="link"
                    onClick={() => selectDestination && selectDestination("")}
                  >
                    Back
                  </Button>
                ) : (
                  <Button
                    variant="link"
                    onClick={() => navigateTo("/destination/catalog")}
                  >
                    Back to catalog
                  </Button>
                )}
              </ActionGroup>
            </PageSection>
          </>
        )}
      </FormContextProvider>
    </>
  );
};

export { CreateDestination };
