/* eslint-disable @typescript-eslint/no-explicit-any */
import PageHeader from "@components/PageHeader";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import {
  ActionGroup,
  Button,
  ButtonType,
  Card,
  CardBody,
  Form,
  FormContextProvider,
  FormFieldGroup,
  FormFieldGroupHeader,
  FormGroup,
  FormGroupLabelHelp,
  FormHelperText,
  FormSelect,
  FormSelectOption,
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
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPost, TransformData } from "src/apis";
import { API_URL } from "@utils/constants";
import { useNotification } from "@appContext/AppNotificationContext";
import { find } from "lodash";

export interface ICreateTransformsProps {
  modelLoaded?: boolean;
  onSelection?: (selection: TransformData) => void;
}

const CreateTransforms: React.FunctionComponent<ICreateTransformsProps> = ({
  modelLoaded,
  onSelection,
}) => {
  const navigate = useNavigate();

  const navigateTo = (url: string) => {
    navigate(url);
  };

  const { addNotification } = useNotification();

  const [editorSelected, setEditorSelected] = React.useState("form-editor");

  const [isLoading] = React.useState(false);

  const [isOpen, setIsOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string>("");
  const [inputValue, setInputValue] = React.useState<string>("");
  const [filterValue, setFilterValue] = React.useState<string>("");
  const [selectOptions, setSelectOptions] =
    React.useState<SelectOptionProps[]>();
  const [focusedItemIndex, setFocusedItemIndex] = React.useState<number | null>(
    null
  );
  const [activeItemId, setActiveItemId] = React.useState<string | null>(null);
  const textInputRef = React.useRef<HTMLInputElement>();

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
          placeholder="Select a state"
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

  const createNewTransform = async (values: Record<string, string>) => {
    const {
      "transform-name": transformName,
      description: description,
      ...restValues
    } = values;
    const payload = {
      description: description,
      type: selected,
      schema: "schema321",
      vaults: [],
      config: { ...restValues },
      name: transformName,
    };
    const response = await createPost(`${API_URL}/api/transforms`, payload);
    if (response.error) {
      addNotification(
        "danger",
        `Source creation failed`,
        `Failed to create ${(response.data as any).name}: ${response.error}`
      );
    } else {
      modelLoaded && onSelection && onSelection(response.data as any);
      addNotification(
        "success",
        `Create successful`,
        `Source "${(response.data as any).name}" created successfully.`
      );
      !modelLoaded && navigateTo("/transform");
    }
  };

  const dynamicFormDefaultValues = Object.entries(
    find(transforms, { transform: selected })?.properties || {}
  ).reduce((acc: Record<string, string>, [key, value]) => {
    if (value.defaultValue) {
      acc[`debezium.transforms.transform-name.${key}`] = value.defaultValue;
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

  return (
    <>
      {!modelLoaded && (
        <PageHeader
          title="Create transform"
          description="Add a transform, Before the messages are delivered to the sink, they can run through a sequence of transformations."
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
      <FormContextProvider initialValues={initialValues}>
        {({ setValue, getValue, setError, values, errors }) => (
          <>
            <PageSection
              isWidthLimited={true}
              isCenterAligned
              isFilled
              className={
                editorSelected === "form-editor" ? "pipeline-page-section" : ""
              }
            >
              {editorSelected === "form-editor" ? (
                <Card className="pipeline-card-body">
                  <CardBody isFilled>
                    <Form isWidthLimited>
                      <FormGroup
                        label="Transform class"
                        labelHelp={
                          <Popover
                            bodyContent={
                              "The name of Java class implementing the transformation"
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
                        label="Transform name"
                        isRequired
                        fieldId="transform-name"
                      >
                        <TextInput
                          id="transform-name"
                          name="transform-name"
                          aria-label="transform name"
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

                      <FormGroup label="Description" fieldId="description">
                        <TextInput
                          id="description"
                          name="description"
                          aria-label="description"
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
                                text: "Transform configuration properties",
                                id: `field-group-${selected}-id`,
                              }}
                              titleDescription={
                                !values["transform-name"] ? (
                                  <>
                                    Enter <i>transform name</i> to enable
                                    configuration properties.
                                  </>
                                ) : (
                                  <>
                                    Configuration properties passed to the
                                    transformation with name
                                    <i>"{values["transform-name"]}"</i>
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
                                fieldId={`debezium.transforms.${transformName}.${key}`}
                                labelHelp={
                                  <Popover bodyContent={description}>
                                    <FormGroupLabelHelp aria-label="More info for name field" />
                                  </Popover>
                                }
                              >
                                {isBoolean ? (
                                  <Switch
                                    id={`debezium.transforms.${transformName}.${key}`}
                                    label="On"
                                    isDisabled={transformName === ""}
                                    isChecked={
                                      getValue(
                                        `debezium.transforms.${transformName}.${key}`
                                      ) === "true" ||
                                      property?.defaultValue === "true"
                                    }
                                    onChange={(checked) => {
                                      const value = checked ? "true" : "false";
                                      setValue(
                                        `debezium.transforms.${transformName}.${key}`,
                                        value
                                      );
                                      setError(
                                        `debezium.transforms.${transformName}.${key}`,
                                        undefined
                                      );
                                    }}
                                  />
                                ) : dropDown ? (
                                  <FormSelect
                                    value={
                                      getValue(
                                        `debezium.transforms.${transformName}.${key}`
                                      ) || property?.defaultValue
                                    }
                                    isDisabled={transformName === ""}
                                    onChange={(_event, value) => {
                                      setValue(
                                        `debezium.transforms.${transformName}.${key}`,
                                        value
                                      );
                                      setError(
                                        `debezium.transforms.${transformName}.${key}`,
                                        undefined
                                      );
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
                                    id={`debezium.transforms.${transformName}.${key}`}
                                    aria-label={key}
                                    isDisabled={transformName === ""}
                                    onChange={(_event, value) => {
                                      setValue(
                                        `debezium.transforms.${transformName}.${key}`,
                                        value
                                      );
                                      setError(
                                        `debezium.transforms.${transformName}.${key}`,
                                        undefined
                                      );
                                    }}
                                    value={
                                      getValue(
                                        `debezium.transforms.${transformName}.${key}`
                                      ) || property?.defaultValue
                                    }
                                    validated={
                                      errors[
                                        `debezium.transforms.${transformName}.${key}`
                                      ]
                                        ? "error"
                                        : "default"
                                    }
                                  />
                                )}

                                <FormHelperText>
                                  <HelperText>
                                    <HelperTextItem
                                      variant={
                                        errors[
                                          `debezium.transforms.${transformName}.${key}`
                                        ]
                                          ? "error"
                                          : "default"
                                      }
                                      {...(errors[
                                        `debezium.transforms.${transformName}.${key}`
                                      ] && {
                                        icon: <ExclamationCircleIcon />,
                                      })}
                                    >
                                      {
                                        errors[
                                          `debezium.transforms.${transformName}.${key}`
                                        ]
                                      }
                                    </HelperTextItem>
                                  </HelperText>
                                </FormHelperText>
                              </FormGroup>
                            );
                          })}
                        </FormFieldGroup>
                      )}
                    </Form>
                  </CardBody>
                </Card>
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

                    if (!values["transform-name"]) {
                      setError("transform-name", "transform name is required.");
                    } else {
                      createNewTransform(values);
                    }
                  }}
                >
                  Create transform
                </Button>
                {modelLoaded && (
                  <Button
                    variant="link"
                    onClick={() => navigateTo("/transform")}
                  >
                    Back
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
