/* eslint-disable @typescript-eslint/no-explicit-any */
// useConnectorForm.ts
import { useState } from 'react';
import { createPost, Source } from '../apis/apis';
import { find } from 'lodash';
import { convertMapToObject } from '../utils/helpers';
import { useNotification } from '../appLayout/AppNotificationContext';

export type Properties = { key: string; value: string };

interface UseConnectorFormProps {
  connectorType: 'source' | 'destination';
  modelLoaded?: boolean;
  onSelection?: (selection: Source) => void;
  navigateTo: (path: string) => void;
  createEndpoint: string;
  catalog: any[];
}

export const useConnectorForm = ({
  connectorType,
  modelLoaded,
  onSelection,
  navigateTo,
  createEndpoint,
  catalog
}: UseConnectorFormProps) => {
  const { addNotification } = useNotification();
  const [code, setCode] = useState({
    name: "",
    description: "",
    type: "",
    schema: "schema123",
    vaults: [],
    config: {},
  });

  const [errorWarning, setErrorWarning] = useState<string[]>([]);
  const [editorSelected, setEditorSelected] = useState("form-editor");
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

  const createNewConnector = async (payload: any) => {
    const response = await createPost(createEndpoint, payload);

    if (response.error) {
      addNotification(
        "danger",
        `${connectorType} creation failed`,
        `Failed to create ${(response.data as Source)?.name}: ${response.error}`
      );
    } else {
      modelLoaded && onSelection && onSelection(response.data as Source);
      addNotification(
        "success",
        `Create successful`,
        `${connectorType} "${(response.data as Source).name}" created successfully.`
      );
      !modelLoaded && navigateTo(`/${connectorType}`);
    }
  };

  const handleCreate = async (
    values: Record<string, string>,
    setError: (fieldId: string, error: string | undefined) => void,
    connectorId?: string
  ) => {
    if (editorSelected === "form-editor") {
      if (!values["source-name"]) {
        setError("source-name", `${connectorType} name is required.`);
      } else {
        setIsLoading(true);
        const errorWarning = [] as string[];
        properties.forEach((value: Properties) => {
          if (value.key === "" || value.value === "") {
            errorWarning.push(value.key);
          }
        });
        setErrorWarning(errorWarning);
        if (errorWarning.length > 0) {
          addNotification(
            "danger",
            `${connectorType} creation failed`,
            `Please fill both Key and Value fields for all the properties.`
          );
          setIsLoading(false);
          return;
        }
        const payload = {
          description: values["details"],
          type: find(catalog, { id: connectorId })?.type || "",
          schema: "schema321",
          vaults: [],
          config: convertMapToObject(properties),
          name: values["source-name"],
        };
        await createNewConnector(payload);
        setIsLoading(false);
      }
    } else {
      setIsLoading(true);
      await createNewConnector(code);
      setIsLoading(false);
    }
  };

  return {
    code,
    setCode,
    errorWarning,
    editorSelected,
    setEditorSelected,
    isLoading,
    properties,
    setProperties,
    handleAddProperty,
    handleDeleteProperty,
    handlePropertyChange,
    handleCreate,
  };
};