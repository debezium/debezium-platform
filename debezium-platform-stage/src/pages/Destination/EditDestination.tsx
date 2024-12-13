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
import { useNavigate, useParams } from "react-router-dom";
import "./CreateDestination.css";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { useState } from "react";
import {
  Destination,
  DestinationConfig,
  editPut,
  fetchDataTypeTwo,
} from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { convertMapToObject } from "../../utils/helpers";
import { useData } from "../../appLayout/AppContext";
import { useNotification } from "../../appLayout/AppNotificationContext";
import SourceSinkForm from "@components/SourceSinkForm";
import PageHeader from "@components/PageHeader";

type Properties = { key: string; value: string };

const EditDestination: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { destinationId } = useParams<{ destinationId: string }>();

  const navigateTo = (url: string) => {
    navigate(url);
  };

  const { navigationCollapsed } = useData();

  const { addNotification } = useNotification();

  const [editorSelected, setEditorSelected] = React.useState("form-editor");

  const [errorWarning, setErrorWarning] = useState<string[]>([]);

  const [destination, setDestination] = useState<Destination>();
  const [isFetchLoading, setIsFetchLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const [properties, setProperties] = useState<
    Map<string, Properties>
  >(new Map([["key0", { key: "", value: "" }]]));
  const [keyCount, setKeyCount] = useState<number>(1);

  const setConfigProperties = (configProp: DestinationConfig) => {
    let i = 0;
    const configMap = new Map();
    for (const config in configProp) {
      configMap.set(`key${i}`, { key: config, value: configProp[config] });
      i++;
    }
    setProperties(configMap);
    setKeyCount(configMap.size);
  };

  React.useEffect(() => {
    const fetchDestinations = async () => {
      setIsFetchLoading(true);
      const response = await fetchDataTypeTwo<Destination>(
        `${API_URL}/api/destinations/${destinationId}`
      );

      if (response.error) {
        setError(response.error);
      } else {
        setDestination(response.data as Destination);
        setConfigProperties(response.data?.config ?? { "": "" });
      }

      setIsFetchLoading(false);
    };

    fetchDestinations();
  }, [destinationId]);

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

  const editDestination = async (values: Record<string, string>) => {
    const payload = {
      description: values["description"],
      config: convertMapToObject(properties),
      name: values["destination-name"],
    };

    const response = await editPut(
      `${API_URL}/api/destinations/${destinationId}`,
      payload
    );

    if (response.error) {
      addNotification(
        "danger",
        `Edit failed`,
        `Failed to edit ${(response.data as Destination).name}: ${response.error}`
      );
    } else {
      addNotification(
        "success",
        `Edit successful`,
        `Destination "${(response.data as Destination).name}" edited successfully.`
      );
    }
  };

  const handleEditDestination = async (values: Record<string, string>) => {
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
        `Destination edit failed`,
        `Please fill both Key and Value fields for all the properties.`
      );
      setIsLoading(false);
      return;
    }
    await editDestination(values);
    setIsLoading(false);
    navigateTo("/destination");
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

  if (isFetchLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <>
      <PageHeader
        title="Edit destination"
        description=" To configure and create a connector fill out the below form or use
            the smart editor to setup a new Destination connector. If you
            already have a configuration file, you can setup a new Destination
            connector by uploading it in the smart editor."
      />

      <PageSection className="create_destination-toolbar">
        <Toolbar id="create-editor-toggle">
          <ToolbarContent>
            <ToolbarItem>
              <ToggleGroup aria-label="Toggle between form editor and smart editor">
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

      <FormContextProvider
        initialValues={{
          "destination-name": destination?.name || "",
          description: destination?.description || "",
        }}
      >
        {({ setValue, getValue, setError, values, errors }) => (
          <>
            <PageSection
              isWidthLimited
              isCenterAligned
              isFilled
              className={
                navigationCollapsed && editorSelected === "form-editor"
                  ? "custom-page-section create_destination-page_section"
                  : "create_destination-page_section"
              }
            >
              {editorSelected === "form-editor" ? (
                <SourceSinkForm
                  ConnectorId={destinationId || ""}
                  dataType={destination?.type || ""}
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
                      handleEditDestination(values);
                    }
                  }}
                >
                  Save changes
                </Button>
                <Button
                  variant="link"
                  onClick={() => navigateTo("/destination")}
                >
                  Cancel
                </Button>
              </ActionGroup>
            </PageSection>
          </>
        )}
      </FormContextProvider>
    </>
  );
};

export { EditDestination };
