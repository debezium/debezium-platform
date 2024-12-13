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
import "./CreateSource.css";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import { useState } from "react";
import { createPost, Source } from "../../apis/apis";
import { API_URL } from "../../utils/constants";
import { convertMapToObject } from "../../utils/helpers";
import sourceCatalog from "../../__mocks__/data/SourceCatalog.json";
import { find } from "lodash";
import { useNotification } from "../../appLayout/AppNotificationContext";
import SourceSinkForm from "@components/SourceSinkForm";
import PageHeader from "@components/PageHeader";

interface CreateSourceProps {
  modelLoaded?: boolean;
  selectedId?: string;
  selectSource?: (sourceId: string) => void;
  onSelection?: (selection: Source) => void;
}

type Properties = { key: string; value: string };

const CreateSource: React.FunctionComponent<CreateSourceProps> = ({
  modelLoaded,
  selectedId,
  selectSource,
  onSelection,
}) => {
  const navigate = useNavigate();

  const sourceIdParam = useParams<{ sourceId: string }>();
  const sourceIdModel = selectedId;
  const sourceId = modelLoaded ? sourceIdModel : sourceIdParam.sourceId;

  const [errorWarning, setErrorWarning] = useState<string[]>([]);

  const navigateTo = (url: string) => {
    navigate(url);
  };

  const { addNotification } = useNotification();

  const [editorSelected, setEditorSelected] = React.useState("form-editor");

  const [isLoading, setIsLoading] = useState(false);

  const [properties, setProperties] = useState<Map<string, Properties>>(
    new Map([["key0", { key: "", value: "" }]])
  );
  const [keyCount, setKeyCount] = useState<number>(1);

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

  const createNewSource = async (values: Record<string, string>) => {
    const payload = {
      description: values["details"],
      type: find(sourceCatalog, { id: sourceId })?.type || "",
      schema: "schema321",
      vaults: [],
      config: convertMapToObject(properties),
      name: values["source-name"],
    };

    const response = await createPost(`${API_URL}/api/sources`, payload);

    if (response.error) {
      addNotification(
        "danger",
        `Source creation failed`,
        `Failed to create ${(response.data as Source).name}: ${response.error}`
      );
    } else {
      modelLoaded && onSelection && onSelection(response.data as Source);
      addNotification(
        "success",
        `Create successful`,
        `Source "${(response.data as Source).name}" created successfully.`
      );
    }
  };

  const handleCreateSource = async (values: Record<string, string>) => {
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
        `Source creation failed`,
        `Please fill both Key and Value fields for all the properties.`
      );
      setIsLoading(false);
      return;
    }
    await createNewSource(values);
    setIsLoading(false);
    !modelLoaded && navigateTo("/source");
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
          title="Create source"
          description="To configure and create a connector fill out the below form or use the
          smart editor to setup a new source connector. If you already have a
          configuration file, you can setup a new source connector by uploading
          it in the smart editor."
        />
      )}
      <PageSection className="create_source-toolbar">
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
                  ? "custom-page-section create_source-page_section"
                  : "create_source-page_section"
              }
            >
              {editorSelected === "form-editor" ? (
                <SourceSinkForm
                  ConnectorId={sourceId || ""}
                  connectorType="source"
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
              <ActionGroup className="create_source-footer">
                <Button
                  variant="primary"
                  isLoading={isLoading}
                  isDisabled={isLoading}
                  type={ButtonType.submit}
                  onClick={(e) => {
                    e.preventDefault();

                    if (!values["source-name"]) {
                      setError("source-name", "Source name is required.");
                    } else {
                      handleCreateSource(values);
                    }
                  }}
                >
                  Create source
                </Button>
                {modelLoaded ? (
                  <Button
                    variant="link"
                    onClick={() => selectSource && selectSource("")}
                  >
                    Back
                  </Button>
                ) : (
                  <Button
                    variant="link"
                    onClick={() => navigateTo("/source/catalog")}
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

export { CreateSource };
