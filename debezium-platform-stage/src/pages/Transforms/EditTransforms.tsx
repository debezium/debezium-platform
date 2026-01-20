/* eslint-disable @typescript-eslint/no-explicit-any */
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Alert,
  Button,
  ButtonType,
  Card,
  CardBody,
  Checkbox,
  Form,
  FormContextProvider,
  FormFieldGroup,
  FormFieldGroupHeader,
  FormGroup,
  FormGroupLabelHelp,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  FormSelectOptionProps,
  HelperText,
  HelperTextItem,
  MenuToggle,
  MenuToggleElement,
  PageSection,
  Popover,
  Select,
  SelectList,
  SelectOption,
  SelectOptionProps,
  Switch,
  TextInput,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import {
  CodeIcon,
  ExclamationCircleIcon,
  PencilAltIcon,
} from "@patternfly/react-icons";
import * as React from "react";
import transforms from "../../__mocks__/data/DebeziumTransfroms.json";
import predicates from "../../__mocks__/data/Predicates.json";
import { useState } from "react";
import style from "../../styles/createConnector.module.css"
import {
  editPut,
  fetchDataTypeTwo,
  TransformData,
  TransformPayload,
} from "src/apis";
import { API_URL } from "@utils/constants";
import { useNotification } from "@appContext/AppNotificationContext";
import { isEmpty } from "lodash";
import Ajv from "ajv";
import { useTranslation } from "react-i18next";
import { transformSchema } from "@utils/schemas";
import EditConfirmationModel from "../components/EditConfirmationModel";
import { PageHeader } from "@patternfly/react-component-groups";
import { useParams, useSearchParams } from "react-router-dom";
import { useData } from "@appContext/AppContext";

const ajv = new Ajv();

export interface IEditTransformsProps {
  onSelection?: (selection: TransformData) => void;
}

const EditTransforms: React.FunctionComponent<IEditTransformsProps> = ({
  onSelection,
}) => {
  const { darkMode } = useData();
  const { transformId } = useParams<{ transformId: string }>();


  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<{
    values: Record<string, string>;
    setError: (fieldId: string, error: string | undefined) => void;
  } | null>(null);

  const [searchParams] = useSearchParams();
  const initialState = searchParams.get("state") as "view" | "edit" | null;

  const [viewMode, setViewMode] = useState<boolean>(initialState === "view");

  const { addNotification } = useNotification();
  const { t } = useTranslation();

  const [transformData, setTransformData] = useState<TransformData>();
  const [isFetchLoading, setIsFetchLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [editorSelected, setEditorSelected] = React.useState("form-editor");

  const [isLoading, setIsLoading] = React.useState(false);

  const [isOpen, setIsOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string>("");
  const [inputValue, setInputValue] = React.useState<string>("");
  const [filterValue, setFilterValue] = React.useState<string>("");
  const [focusedItemIndex, setFocusedItemIndex] = React.useState<number | null>(
    null
  );
  const [activeItemId, setActiveItemId] = React.useState<string | null>(null);
  const textInputRef = React.useRef<HTMLInputElement>(null);

  const NO_RESULTS = "no results";

  const [code, setCode] = useState({
    name: "",
    description: "",
    type: "",
    schema: "schema123",
    vaults: [],
    config: {},
  });
  const [codeAlert, setCodeAlert] = useState("");
  const validate = ajv.compile(transformSchema);

  const [selectedPredicate, setSelectedPredicate] = React.useState<string>("");
  const [selectPredicateOptions] =
    React.useState<FormSelectOptionProps[]>(() => {
      const selectOption: FormSelectOptionProps[] = predicates.map((item) => ({
        value: item.predicate,
        label: item.predicate,
      }));
      selectOption.unshift({
        value: "",
        label: "Select a predicate type",
        isPlaceholder: true,
      });
      return selectOption;
    });

  const onChange = (
    _event: React.FormEvent<HTMLSelectElement>,
    value: string
  ) => {
    setSelectedPredicate(value);
  };

  // Compute filtered select options based on filterValue
  const selectOptions = React.useMemo(() => {
    const baseOptions: SelectOptionProps[] = transforms.map((item) => ({
      value: item.transform,
      children: item.transform,
    }));
    if (filterValue) {
      const filteredOptions = baseOptions.filter((menuItem) =>
        String(menuItem.children)
          .toLowerCase()
          .includes(filterValue.toLowerCase())
      );

      if (!filteredOptions.length) {
        return [
          {
            isAriaDisabled: true,
            children: `No results found for "${filterValue}"`,
            value: NO_RESULTS,
          },
        ];
      }

      return filteredOptions;
    }

    return baseOptions;
  }, [filterValue, NO_RESULTS]);

  const createItemId = (value: any) =>
    `select-typeahead-${String(value ?? '').replace(/\s+/g, '-')}`;

  const setActiveAndFocusedItem = (itemIndex: number) => {
    setFocusedItemIndex(itemIndex);
    const focusedItem = selectOptions![itemIndex];
    setActiveItemId(createItemId(focusedItem.value));
  };

  const resetActiveAndFocusedItem = () => {
    setFocusedItemIndex(null);
    setActiveItemId(null);
  };

  const closeMenu = () => {
    setIsOpen(false);
    resetActiveAndFocusedItem();
  };

  const onInputClick = () => {
    if (!isOpen) {
      setIsOpen(true);
    } else if (!inputValue) {
      closeMenu();
    }
  };

  const selectOption = (value: string | number, content: string | number) => {
    setInputValue(String(content));
    setFilterValue("");
    setSelected(String(value));
    closeMenu();
  };

  const onSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => {
    if (value && value !== NO_RESULTS) {
      const optionText = selectOptions!.find(
        (option) => option.value === value
      )?.children;
      selectOption(value, optionText as string);
    }
  };

  const onTextInputChange = (
    _event: React.FormEvent<HTMLInputElement>,
    value: string
  ) => {
    setInputValue(value);
    setFilterValue(value);

    resetActiveAndFocusedItem();

    if (value !== selected) {
      setSelected("");
    }

    // Open the menu when the input value changes and the new value is not empty
    if (value && !isOpen) {
      setIsOpen(true);
    }
  };

  const handleMenuArrowKeys = (key: string) => {
    let indexToFocus = 0;
    if (!isOpen) {
      setIsOpen(true);
    }
    if (selectOptions!.every((option) => option.isDisabled)) {
      return;
    }
    if (key === "ArrowUp") {
      if (focusedItemIndex === null || focusedItemIndex === 0) {
        indexToFocus = selectOptions!.length - 1;
      } else {
        indexToFocus = focusedItemIndex - 1;
      }
      // Skip disabled options
      while (selectOptions![indexToFocus].isDisabled) {
        indexToFocus--;
        if (indexToFocus === -1) {
          indexToFocus = selectOptions!.length - 1;
        }
      }
    }
    if (key === "ArrowDown") {
      if (
        focusedItemIndex === null ||
        focusedItemIndex === selectOptions!.length - 1
      ) {
        indexToFocus = 0;
      } else {
        indexToFocus = focusedItemIndex + 1;
      }
      // Skip disabled options
      while (selectOptions![indexToFocus].isDisabled) {
        indexToFocus++;
        if (indexToFocus === selectOptions!.length) {
          indexToFocus = 0;
        }
      }
    }
    setActiveAndFocusedItem(indexToFocus);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const focusedItem =
      focusedItemIndex !== null ? selectOptions![focusedItemIndex] : null;
    switch (event.key) {
      case "Enter":
        if (
          isOpen &&
          focusedItem &&
          focusedItem.value !== NO_RESULTS &&
          !focusedItem.isAriaDisabled
        ) {
          selectOption(focusedItem.value, focusedItem.children as string);
        }
        if (!isOpen) {
          setIsOpen(true);
        }
        break;
      case "ArrowUp":
      case "ArrowDown":
        event.preventDefault();
        handleMenuArrowKeys(event.key);
        break;
    }
  };

  const onToggleClick = () => {
    setIsOpen(!isOpen);
    textInputRef?.current?.focus();
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      variant="typeahead"
      aria-label="Typeahead menu toggle"
      onClick={onToggleClick}
      isExpanded={isOpen}
      isFullWidth
    // isDisabled
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={inputValue}
          onClick={onInputClick}
          onChange={onTextInputChange}
          onKeyDown={onInputKeyDown}
          id="typeahead-select-input"
          autoComplete="off"
          innerRef={textInputRef}
          placeholder="Select a transform"
          {...(activeItemId && { "aria-activedescendant": activeItemId })}
          role="combobox"
          isExpanded={isOpen}
          aria-controls="select-typeahead-listbox"
        />
        <TextInputGroupUtilities
          {...(!inputValue ? { style: { display: "none" } } : {})}
        ></TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  const [initialValues, setInitialValues] = useState<Record<string, string>>(
    {}
  );

  React.useEffect(() => {
    const fetchDestinations = async () => {
      setIsFetchLoading(true);
      const response = await fetchDataTypeTwo<TransformData>(
        `${API_URL}/api/transforms/${transformId}`
      );

      if (response.error) {
        setError(response.error);
      } else {
        setSelected(response.data?.type || "");
        setSelectedPredicate(response.data?.predicate?.type || "");
        setInputValue(response.data?.type || "");
        setTransformData(response.data as TransformData);
        setInitialValues({
          "transform-name": response.data?.name || "",
          description: response.data?.description || "",
          ...response.data?.config,
          ...Object.keys(response.data?.predicate?.config || {}).reduce(
            (acc: Record<string, any>, key) => {
              acc[`predicateConfig.${key}`] =
                response.data?.predicate?.config[key];
              return acc;
            },
            {} as Record<string, any>
          ),
          "predicate.negate": "" + response.data?.predicate?.negate || "false",
        });
        setCode(response.data as any);
      }

      setIsFetchLoading(false);
    };

    fetchDestinations();
  }, [transformId]);

  const editTransform = React.useCallback(
    async (payload: TransformPayload) => {
      const response = await editPut(
        `${API_URL}/api/transforms/${transformData?.id}`,
        payload
      );
      if (response.error) {
        addNotification(
          "danger",
          `Source edit failed`,
          `Failed to create ${(response.data as any).name}: ${response.error}`
        );
      } else {
        onSelection?.(response.data as any);
        addNotification(
          "success",
          `Edit successful`,
          `Source "${(response.data as any).name}" edited successfully.`
        );
        setViewMode(true);
      }
    },
    [transformData?.id, addNotification, onSelection]
  );

  const handleEdit = React.useCallback(
    async (
      values: Record<string, string>,
      setError: (fieldId: string, error: string | undefined) => void
    ) => {
      if (editorSelected === "form-editor") {
        if (!values["transform-name"]) {
          setError("transform-name", "transform name is required.");
        } else {
          setIsLoading(true);
          const {
            "transform-name": transformName,
            description: description,
            ...restValues
          } = values;
          const configProperties = transformData?.config || {};

          const oldConfig = { ...configProperties };
          const oldPredicates = transformData?.predicate || {};

          const newValues: Record<string, string> = {};
          const newPredicates: any = { config: {} };

          Object.entries(restValues).forEach(([key, value]) => {
            if (key.startsWith("predicate")) {
              if (key.startsWith("predicateConfig.")) {
                newPredicates.config[key.replace("predicateConfig.", "")] =
                  value;
              } else {
                newPredicates[key.replace("predicate.", "")] = value;
              }
            } else {
              newValues[key] = value;
            }
          });
          if (selectedPredicate) {
            newPredicates.type = selectedPredicate;
          }

          const updatedConfig = { ...oldConfig, ...newValues };
          const updatedPredicates =
            Object.keys(newPredicates).length > 1 ||
              !isEmpty(newPredicates.config)
              ? {
                ...oldPredicates,
                ...newPredicates,
                config: { ...newPredicates.config },
              }
              : {};

          const payload = {
            description: description,
            config: { ...updatedConfig },
            predicate: { ...updatedPredicates },
            name: transformName,
          };
          await editTransform(payload as TransformPayload);
          setIsLoading(false);
        }
      } else {
        const payload = code;
        const isValid = validate(payload);
        if (!isValid) {
          setCodeAlert(ajv.errorsText(validate.errors));
          return;
        } else {
          setIsLoading(true);
          await editTransform(payload as TransformPayload);
          setIsLoading(false);
        }
      }
    },
    [
      editorSelected,
      transformData?.config,
      transformData?.predicate,
      selectedPredicate,
      editTransform,
      code,
      validate,
    ]
  );

  const handleItemClick = (
    event:
      | MouseEvent
      | React.MouseEvent<any, MouseEvent>
      | React.KeyboardEvent<Element>
  ) => {
    const id = event.currentTarget.id;
    setEditorSelected(id);
  };

  const onEditorDidMount = (
    editor: { layout: () => void; focus: () => void },
    monaco: {
      editor: {
        getModels: () => {
          updateOptions: (arg0: { tabSize: number }) => void;
        }[];
      };
    }
  ) => {
    editor.layout();
    editor.focus();
    monaco.editor.getModels()[0].updateOptions({ tabSize: 5 });
  };

  return (
    <>
      {viewMode ? (

        <PageHeader
          title={transformData?.name || t("transform:edit.title")}
          subtitle={`${transformData?.type} transform.`}
          actionMenu={
            <Button variant="secondary" ouiaId="Primary" icon={<PencilAltIcon />}
              onClick={() => { setViewMode(false); }}>
              {t("edit")}
            </Button>
          }
        // icon={ <ConnectorImage connectorType={source?.type || sourceId || ""} size={35} />}
        />
      ) : (
        <PageHeader
          title={<>{t("edit")} <i>{transformData?.name}</i></>}
          subtitle={t("transform:edit.description")}
        />
      )}

      {!viewMode && (
        <PageSection className={style.createConnector_toolbar}>
          <Toolbar id="transform-editor-toggle">
            <ToolbarContent>
              <ToolbarItem>
                <ToggleGroup aria-label="Toggle between form editor and smart editor">
                  <ToggleGroupItem
                    icon={<PencilAltIcon />}
                    text={t("formEditor")}
                    aria-label={t("formEditor")}
                    buttonId="form-editor"
                    isSelected={editorSelected === "form-editor"}
                    onChange={handleItemClick}
                  />

                  <ToggleGroupItem
                    icon={<CodeIcon />}
                    text={t("smartEditor")}
                    aria-label={t("smartEditor")}
                    buttonId="smart-editor"
                    isSelected={editorSelected === "smart-editor"}
                    onChange={handleItemClick}
                  />
                </ToggleGroup>
              </ToolbarItem>
            </ToolbarContent>
          </Toolbar>
        </PageSection>)}
      {isFetchLoading ? (
        <div>{t("loading")}</div>
      ) : error ? (
        <div>Error: {error}</div>
      ) : (
        <FormContextProvider initialValues={initialValues}>
          {({ setValue, getValue, setError, values, errors }) => (
            <>
              <PageSection
                isWidthLimited={true}
                isCenterAligned
                isFilled
                className={
                  editorSelected === "form-editor"
                    ? "pipeline-page-section"
                    : ""
                }
              >
                {editorSelected === "form-editor" ? (
                  <Card className="pipeline-card-body">
                    <CardBody isFilled>
                      <Form isWidthLimited>
                        <FormGroup
                          label={t("transform:form.classField")}
                          labelHelp={
                            <Popover
                              bodyContent={
                                t("transform:form.classFieldHelper")
                              }
                            >
                              <FormGroupLabelHelp aria-label="More info for name field" />
                            </Popover>
                          }
                          isRequired
                          fieldId="transform-class"
                        >
                          <Select
                            id="transform-class"
                            aria-label="transform-class"
                            isOpen={isOpen}
                            selected={selected}
                            onSelect={onSelect}
                            onOpenChange={(isOpen) => {
                              if (!isOpen) {
                                closeMenu();
                              }
                            }}
                            toggle={toggle}
                            shouldFocusFirstItemOnOpen={false}
                          >
                            <SelectList id="select-typeahead-listbox">
                              {selectOptions &&
                                selectOptions.map((option, index) => (
                                  <SelectOption
                                    key={option.value || option.children}
                                    isFocused={focusedItemIndex === index}
                                    isDisabled
                                    className={option.className}
                                    id={createItemId(option.value)}
                                    {...option}
                                    ref={null}
                                  />
                                ))}
                            </SelectList>
                          </Select>
                          <FormHelperText>
                            <HelperText>
                              <HelperTextItem
                                variant={
                                  errors["transform-class"]
                                    ? "error"
                                    : "default"
                                }
                                {...(errors["transform-class"] && {
                                  icon: <ExclamationCircleIcon />,
                                })}
                              >
                                {errors["transform-class"]}
                              </HelperTextItem>
                            </HelperText>
                          </FormHelperText>
                        </FormGroup>
                        <FormGroup
                          label={t("transform:form.nameField")}
                          isRequired
                          fieldId="transform-name"
                        >
                          <TextInput
                            id="transform-name"
                            readOnlyVariant={viewMode ? "plain" : undefined}
                            name="transform-name"
                            aria-label={t("transform:form.nameField")}
                            onChange={(_event, value) => {
                              setValue("transform-name", value);
                              setError("transform-name", undefined);
                            }}
                            value={getValue("transform-name")}
                            validated={
                              errors["transform-name"] ? "error" : "default"
                            }
                          />
                          <FormHelperText>
                            <HelperText>
                              <HelperTextItem
                                variant={
                                  errors["transform-name"] ? "error" : "default"
                                }
                                {...(errors["transform-name"] && {
                                  icon: <ExclamationCircleIcon />,
                                })}
                              >
                                {errors["transform-name"]}
                              </HelperTextItem>
                            </HelperText>
                          </FormHelperText>
                        </FormGroup>

                        <FormGroup label={t("transform:form.descriptionField")} fieldId="description">
                          <TextInput
                            id="description"
                            readOnlyVariant={viewMode ? "plain" : undefined}
                            name="description"
                            aria-label={t("transform:form.descriptionField")}
                            onChange={(_event, value) => {
                              setValue("description", value);
                              setError("description", undefined);
                            }}
                            value={getValue("description")}
                          />
                        </FormGroup>

                        {selected && (
                          <FormFieldGroup
                            header={
                              <FormFieldGroupHeader
                                titleText={{
                                  text: t("transform:form.subsectionTitle"),
                                  id: `field-group-${selected}-id`,
                                }}
                                titleDescription={
                                  !values["transform-name"] ? (
                                    <>
                                      {t("transform:form.subsectionDescription")}
                                    </>
                                  ) : (
                                    <>
                                      {t("transform:form.subsectionDisabledDescription", { val: values["transform-name"] })}
                                    </>
                                  )
                                }
                              />
                            }
                          >
                            {Object.keys(
                              transforms.find((t) => t.transform === selected)
                                ?.properties || {}
                            ).map((key) => {
                              const properties = transforms.find(
                                (t) => t.transform === selected
                              )?.properties;
                              const property = properties
                                ? (properties as Record<string, any>)[key]
                                : undefined;

                              const isBoolean = property?.type === "BOOLEAN";
                              const description = property?.description;
                              const dropDown = property?.enum;
                              const transformName =
                                getValue("transform-name") || "";

                              return (
                                <FormGroup
                                  key={key}
                                  label={property?.title || key}
                                  fieldId={key}
                                  labelHelp={
                                    <Popover bodyContent={description}>
                                      <FormGroupLabelHelp aria-label="More info for name field" />
                                    </Popover>
                                  }
                                >
                                  {isBoolean ? (
                                    <Switch
                                      id={key}
                                      label="On"
                                      isDisabled={transformName === "" || viewMode}
                                      isChecked={
                                        getValue(key) === "true" ||
                                        property?.defaultValue === "true"
                                      }
                                      onChange={(checked) => {
                                        const value = checked
                                          ? "true"
                                          : "false";
                                        setValue(key, value);
                                        setError(key, undefined);
                                      }}
                                    />
                                  ) : dropDown ? (
                                    <FormSelect
                                      value={
                                        getValue(key) || property?.defaultValue
                                      }
                                      isDisabled={transformName === "" || viewMode}
                                      onChange={(_event, value) => {
                                        setValue(key, value);
                                        setError(key, undefined);
                                      }}
                                      aria-label="FormSelect Input"
                                      ouiaId="BasicFormSelect"
                                    >
                                      {dropDown.map(
                                        (
                                          value: string,
                                          index: React.Key | null | undefined
                                        ) => (
                                          <FormSelectOption
                                            key={index}
                                            value={value}
                                            label={value}
                                          />
                                        )
                                      )}
                                    </FormSelect>
                                  ) : (
                                    <TextInput
                                      id={key}
                                      readOnlyVariant={viewMode ? "plain" : undefined}
                                      aria-label={key}
                                      isDisabled={transformName === ""}
                                      onChange={(_event, value) => {
                                        setValue(key, value);
                                        setError(key, undefined);
                                      }}
                                      defaultValue={
                                        (!isEmpty(initialValues) &&
                                          getValue(key)) ||
                                        property?.defaultValue
                                      }
                                      validated={
                                        errors[key] ? "error" : "default"
                                      }
                                    />
                                  )}

                                  <FormHelperText>
                                    <HelperText>
                                      <HelperTextItem
                                        variant={
                                          errors[key] ? "error" : "default"
                                        }
                                        {...(errors[key] && {
                                          icon: <ExclamationCircleIcon />,
                                        })}
                                      >
                                        {errors[key]}
                                      </HelperTextItem>
                                    </HelperText>
                                  </FormHelperText>
                                </FormGroup>
                              );
                            })}
                          </FormFieldGroup>
                        )}
                        <FormFieldGroup
                          header={
                            <FormFieldGroupHeader
                              titleText={{
                                text: t("transform:predicates.title"),
                                id: `field-group-${selected}-id`,
                              }}
                              titleDescription={
                                t("transform:predicates.description")}
                            />
                          }
                        >
                          <FormGroup
                            label={t("transform:form.predicateTypeField")}
                            labelHelp={
                              <Popover
                                bodyContent={
                                  t("transform:form.predicateTypeFieldHelper")
                                }
                              >
                                <FormGroupLabelHelp aria-label="More info for name field" />
                              </Popover>
                            }
                            fieldId="predicate-type"
                          >
                            <FormSelect
                              value={selectedPredicate}
                              onChange={onChange}
                              isDisabled={viewMode}
                              aria-label={t("transform:form.predicateTypeField")}
                              ouiaId="BasicFormSelect"
                            >
                              {selectPredicateOptions?.map((option, index) => (
                                <FormSelectOption
                                  isDisabled={option.isDisabled}
                                  key={index}
                                  value={option.value}
                                  label={option.label}
                                  isPlaceholder={option.isPlaceholder}
                                />
                              ))}
                            </FormSelect>
                          </FormGroup>
                          {selectedPredicate &&
                            selectedPredicate !==
                            "org.apache.kafka.connect.transforms.predicates.RecordIsTombstone" &&
                            (() => {
                              const predicate = predicates.find(
                                (predicate) =>
                                  predicate.predicate === selectedPredicate
                              );
                              const predicateProperties =
                                predicate?.properties as Record<string, any>;
                              const propertyKey = Object.keys(
                                predicateProperties || {}
                              )[0];
                              const property =
                                predicateProperties?.[propertyKey];

                              return (
                                <FormGroup
                                  label={property?.title || ""}
                                  isRequired
                                  labelHelp={
                                    <Popover
                                      bodyContent={property?.description || ""}
                                    >
                                      <FormGroupLabelHelp aria-label="More info for name field" />
                                    </Popover>
                                  }
                                  fieldId="predicate-config"
                                >
                                  <TextInput
                                    isRequired
                                    id={property["x-name"]}
                                    readOnlyVariant={viewMode ? "plain" : undefined}
                                    name={property["x-name"]}
                                    aria-label={property["x-name"]}
                                    onChange={(_event, value) => {
                                      setValue(
                                        `predicateConfig.${property["x-name"]}`,
                                        value
                                      );
                                      // setError("description", undefined);
                                    }}
                                    value={getValue(
                                      `predicateConfig.${property["x-name"]}`
                                    )}
                                  />
                                </FormGroup>
                              );
                            })()}
                          {selectedPredicate && (
                            <FormGroup
                              label={t("transform:form.negateField")}
                              fieldId="negate"
                            >
                              <Checkbox
                                id="description-check-1"
                                isDisabled={viewMode}
                                label="Set negate to true"
                                isChecked={
                                  getValue("predicate.negate") === "true"
                                }
                                onChange={(
                                  _event: React.FormEvent<HTMLInputElement>,
                                  checked: boolean
                                ) => {
                                  setValue("predicate.negate", "" + checked);
                                  setError("predicate.negate", undefined);
                                }}
                                description={t("transform:form.negateFieldDescription")}
                              />
                            </FormGroup>
                          )}
                        </FormFieldGroup>
                      </Form>
                    </CardBody>
                  </Card>
                ) : (
                  <>
                    {codeAlert && (
                      <Alert
                        variant="danger"
                        isInline
                        title={`Provided json is not valid: ${codeAlert}`}
                        style={{ marginBottom: "10px" }}
                      />
                    )}
                    <CodeEditor
                      isUploadEnabled
                      isDownloadEnabled
                      isCopyEnabled
                      isLanguageLabelVisible
                      isMinimapVisible
                      language={Language.json}
                      downloadFileName="transforms.json"
                      isFullHeight
                      isDarkTheme={darkMode}
                      code={JSON.stringify(code, null, 2)}
                      onCodeChange={(value) => {
                        try {
                          const parsedCode = JSON.parse(value);
                          setCode(parsedCode);
                        } catch (error) {
                          console.error("Invalid JSON:", error);
                        }
                      }}
                      onEditorDidMount={onEditorDidMount}
                    />
                  </>
                )}
              </PageSection>
              {!viewMode && (
                <PageSection className="pf-m-sticky-bottom" isFilled={false}>
                  <ActionList>
                    <ActionListGroup>
                      <ActionListItem>
                        <Button
                          variant="primary"
                          isLoading={isLoading}
                          isDisabled={isLoading}
                          type={ButtonType.submit}
                          onClick={(e) => {
                            e.preventDefault();
                            setPendingSave({ values, setError });
                            setIsWarningOpen(true);
                          }}
                        >
                          {t("saveChanges")}
                        </Button>
                      </ActionListItem>
                      <ActionListItem>
                        <Button
                          variant="link"
                          onClick={() => setViewMode(true)}
                        >
                          {t("cancel")}
                        </Button>
                      </ActionListItem>
                    </ActionListGroup>
                  </ActionList>
                </PageSection>)}
            </>
          )}
        </FormContextProvider>

      )}
      <EditConfirmationModel
        type="transform"
        isWarningOpen={isWarningOpen}
        setIsWarningOpen={setIsWarningOpen}
        pendingSave={pendingSave}
        setPendingSave={setPendingSave}
        handleEdit={handleEdit} />
    </>
  );
};

export { EditTransforms };
