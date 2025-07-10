/* eslint-disable @typescript-eslint/no-explicit-any */
import PageHeader from "@components/PageHeader";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import {
  ActionGroup,
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
  TimesIcon,
} from "@patternfly/react-icons";
import * as React from "react";
import transforms from "../../__mocks__/data/DebeziumTransfroms.json";
import predicates from "../../__mocks__/data/Predicates.json";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPost, TransformData, TransformPayload } from "src/apis";
import { API_URL } from "@utils/constants";
import { useNotification } from "@appContext/AppNotificationContext";
import { find } from "lodash";
import Ajv from "ajv";
import { useTranslation } from "react-i18next";
import { transformSchema } from "@utils/schemas";
import style from "../../styles/createConnector.module.css"

const ajv = new Ajv();

export interface ICreateTransformsProps {
  modelLoaded?: boolean;
  onSelection?: (selection: TransformData) => void;
}

const CreateTransforms: React.FunctionComponent<ICreateTransformsProps> = ({
  modelLoaded,
  onSelection,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const navigateTo = (url: string) => {
    navigate(url);
  };

  const { addNotification } = useNotification();

  const [editorSelected, setEditorSelected] = useState("form-editor");

  const [isLoading, setIsLoading] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [inputValue, setInputValue] = useState<string>("");
  const [filterValue, setFilterValue] = useState<string>("");
  const [selectOptions, setSelectOptions] = useState<SelectOptionProps[]>();
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement>();

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
  const NO_RESULTS = "no results";

  useEffect(() => {
    const selectOption: SelectOptionProps[] = transforms.map((item) => {
      return {
        value: item.transform,
        children: item.transform,
      };
    });
    setSelectOptions(selectOption);
  }, []);

  const [selectedPredicate, setSelectedPredicate] = React.useState<string>("");
  const [selectPredicateOptions, setSelectPredicateOptions] =
    React.useState<FormSelectOptionProps[]>();

  useEffect(() => {
    const selectOption: FormSelectOptionProps[] = predicates.map((item) => {
      return {
        value: item.predicate,
        label: item.predicate,
      };
    });
    selectOption.unshift({
      value: "",
      label: "Select a predicate type",
      isPlaceholder: true,
    });
    setSelectPredicateOptions(selectOption);
  }, []);

  const onChange = (
    _event: React.FormEvent<HTMLSelectElement>,
    value: string
  ) => {
    setSelectedPredicate(value);
  };

  useEffect(() => {
    const selectOption: SelectOptionProps[] = transforms.map((item) => {
      return {
        value: item.transform,
        children: item.transform,
      };
    });
    let newSelectOptions: SelectOptionProps[] = selectOption;

    // Filter menu items based on the text input value when one exists
    if (filterValue) {
      newSelectOptions = selectOption.filter((menuItem) =>
        String(menuItem.children)
          .toLowerCase()
          .includes(filterValue.toLowerCase())
      );
      if (!newSelectOptions.length) {
        newSelectOptions = [
          {
            isAriaDisabled: true,
            children: `No results found for "${filterValue}"`,
            value: NO_RESULTS,
          },
        ];
      }
      // Open the menu when the input value changes and the new value is not empty
      if (!isOpen) {
        setIsOpen(true);
      }
    }
    setSelectOptions(newSelectOptions);
  }, [filterValue, isOpen]);

  const createItemId = (value: any) =>
    `select-typeahead-${value.replace(" ", "-")}`;

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
      // When no index is set or at the first index, focus to the last, otherwise decrement focus index
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
      // When no index is set or at the last index, focus to the first, otherwise increment focus index
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

  const onClearButtonClick = () => {
    setSelected("");
    setInputValue("");
    setFilterValue("");
    resetActiveAndFocusedItem();
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
        >
          <Button
            variant="plain"
            onClick={onClearButtonClick}
            aria-label="Clear input value"
            icon={<TimesIcon aria-hidden />}
          />
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  const createNewTransform = async (payload: TransformPayload) => {
    const response = await createPost(`${API_URL}/api/transforms`, payload);
    if (response.error) {
      addNotification(
        "danger",
        `Source creation failed`,
        `Failed to create ${(response.data as any).name}: ${response.error}`
      );
    } else {
      modelLoaded && onSelection?.(response.data as any);
      addNotification(
        "success",
        `Create successful`,
        `Source "${(response.data as any).name}" created successfully.`
      );
      !modelLoaded && navigateTo("/transform");
    }
  };

  const handleCreate = async (
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
        const predicateConfig: Record<string, string> = {};
        let transformConfig: Record<string, string> = {};

        if (selectedPredicate) {
          Object.entries(restValues).forEach(([key, value]) => {
            if (key.startsWith("predicate")) {
              if (key.startsWith("predicateConfig.")) {
                predicateConfig[key.replace("predicateConfig.", "")] = value;
              }
            } else {
              transformConfig[key] = value;
            }
          });
        } else {
          transformConfig = restValues;
        }

        const payload = {
          description: description,
          type: selected,
          schema: "schema321",
          vaults: [],
          config: { ...transformConfig },
          ...(selectedPredicate && {
            predicate: {
              type: selectedPredicate,
              config: { ...predicateConfig },
              negate: values["predicate.negate"] === "true",
            },
          }),
          name: transformName,
        };
        await createNewTransform(payload as TransformPayload);
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
        await createNewTransform(payload as TransformPayload);
        setIsLoading(false);
      }
    }
  };

  const dynamicFormDefaultValues = Object.entries(
    find(transforms, { transform: selected })?.properties || {}
  ).reduce((acc: Record<string, string>, [key, value]) => {
    if (value.defaultValue) {
      acc[key] = value.defaultValue;
    }
    return acc;
  }, {});

  const initialValues = {
    "transform-name": "",
    description: "",
    ...dynamicFormDefaultValues,
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
      {!modelLoaded && (
        <PageHeader
          title={t("transform:create.title")}
          description={t("transform:create.description")}
        />
      )}
      <PageSection className={style.createConnector_toolbar}>
        <Toolbar id="transform-editor-toggle">
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
      <FormContextProvider initialValues={initialValues}>
        {({ setValue, getValue, setError, values, errors }) => (
          <>
            <PageSection
              isWidthLimited={true}
              isCenterAligned
              isFilled
              className={`customPageSection ${style.createConnector_pageSection}`}
            >
              {editorSelected === "form-editor" ? (
                <Card>
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
                            !isOpen && closeMenu();
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
                                errors["transform-class"] ? "error" : "default"
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
                                    isDisabled={transformName === ""}
                                    isChecked={
                                      getValue(key) === "true" ||
                                      property?.defaultValue === "true"
                                    }
                                    onChange={(checked) => {
                                      const value = checked ? "true" : "false";
                                      setValue(key, value);
                                      setError(key, undefined);
                                    }}
                                  />
                                ) : dropDown ? (
                                  <FormSelect
                                    value={
                                      getValue(key) || property?.defaultValue
                                    }
                                    isDisabled={transformName === ""}
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
                                    aria-label={key}
                                    isDisabled={transformName === ""}
                                    onChange={(_event, value) => {
                                      setValue(key, value);
                                      setError(key, undefined);
                                    }}
                                    value={
                                      getValue(key) || property?.defaultValue
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
                              t("transform:predicates.description")
                            }
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
                            const property = predicateProperties?.[propertyKey];

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
                          <Checkbox
                            id="description-check-1"
                            label={t("transform:form.negateField")}
                            isChecked={getValue("predicate.negate") === "true"}
                            onChange={(
                              _event: React.FormEvent<HTMLInputElement>,
                              checked: boolean
                            ) => {
                              setValue("predicate.negate", "" + checked);
                              setError("predicate.negate", undefined);
                            }}
                            description={t("transform:form.negateFieldDescription")}
                          />
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
                      className={style.createConnector_alert}
                    />
                  )}
                  <div className={`${style.smartEditor} smartEditor`}>
                    <CodeEditor
                      isUploadEnabled
                      isDownloadEnabled
                      isCopyEnabled
                      isLanguageLabelVisible
                      isMinimapVisible
                      language={Language.json}
                      downloadFileName="transforms.json"
                      isFullHeight
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
                  </div>
                </>
              )}
            </PageSection>
            <PageSection className="pf-m-sticky-bottom" isFilled={false}>
              <ActionGroup className={style.createConnector_footer}>
                <Button
                  variant="primary"
                  isLoading={isLoading}
                  isDisabled={isLoading}
                  type={ButtonType.submit}
                  onClick={(e) => {
                    e.preventDefault();
                    handleCreate(values, setError);
                  }}
                >
                  {t("transform:create.title")}
                </Button>
                {!modelLoaded && (
                  <Button
                    variant="link"
                    onClick={() => navigateTo("/transform")}
                  >
                    {t("back")}
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

export { CreateTransforms };
