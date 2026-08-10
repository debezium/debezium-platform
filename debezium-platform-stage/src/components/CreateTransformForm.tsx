import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Button,
  Checkbox,
  Content,
  Form,
  FormGroup,
  FormGroupLabelHelp,
  FormHelperText,
  HelperText,
  HelperTextItem,
  JumpLinks,
  JumpLinksItem,
  MenuToggle,
  MenuToggleElement,
  Popover,
  Radio,
  Select,
  SelectGroup,
  SelectList,
  SelectOption,
  Skeleton,
  TextInput,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from "@patternfly/react-core";
import {
  ExclamationCircleIcon,
  TimesIcon,
} from "@patternfly/react-icons";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import {
  fetchData,
  TransformData,
  TransformPayload,
} from "src/apis";
import { API_URL } from "@utils/constants";
import { useNotification } from "@appContext/AppNotificationContext";
import {
  CatalogApiResponse,
  CatalogComponentEntry,
  ConnectorSchema,
  SchemaGroup,
  SchemaProperty,
} from "../apis/types";
import SchemaGroupSection from "./SchemaGroupSection";
import {
  buildDependencyMap,
  buildEffectiveSchemaValues,
  collectAllDependants,
} from "@utils/connectorSchemaLayout";
import { buildSchemaConfigPayload } from "@utils/schemaConfigPayload";
import {
  buildGroupedSchemaProperties,
  descriptorPath,
  findEntryByClass,
  getUniqueTransformNames,
  getUniqueCatalogNames,
  getVariantLabel,
  getVariantsForName,
  pickDefaultVariant,
  TRANSFORM_CATALOG_GROUPS,
} from "@utils/transformCatalog";
import "./CreateSchemaForm.css";

export interface CreateTransformFormHandle {
  validate: () => boolean;
  submit: () => void;
  getLastValidationFailureBody: () => string;
}

interface CreateTransformFormProps {
  onSubmit: (payload: TransformPayload) => void;
  initialTransform?: TransformData;
  existingNames?: string[];
}

function scrollIntoViewById(elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  if (el instanceof HTMLElement && typeof el.focus === "function") {
    try {
      el.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }
}

function collectValidationSections(
  newErrors: Record<string, string | undefined>,
  t: TFunction
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const push = (label: string) => {
    if (!seen.has(label)) {
      seen.add(label);
      names.push(label);
    }
  };

  if (
    newErrors["transform-class"] ||
    newErrors["transform-name"] ||
    newErrors["transform-variant"]
  ) {
    push(t("transform:jumplinks.essentials", { defaultValue: "Transform Essentials" }));
  }
  if (Object.keys(newErrors).some((k) => k.startsWith("config:"))) {
    push(t("transform:jumplinks.configuration", { defaultValue: "Transform Configuration" }));
  }
  if (Object.keys(newErrors).some((k) => k.startsWith("predicate"))) {
    push(t("transform:jumplinks.predicate", { defaultValue: "Predicate" }));
  }
  return names;
}

const CreateTransformForm = React.forwardRef<
  CreateTransformFormHandle,
  CreateTransformFormProps
>(
  (
    {
      onSubmit,
      initialTransform,
      existingNames,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const { addNotification } = useNotification();
    const hydratedIdRef = useRef<number | null>(null);
    const initialSchemaValuesRef = useRef<Record<string, string>>({});
    const initialPredicateValuesRef = useRef<Record<string, string>>({});
    const lastValidationFailureBodyRef = useRef("");

    const [activeSection, setActiveSection] = useState("transform-essentials");
    const activeSectionRef = useRef(activeSection);

    const [transformName, setTransformName] = useState("");
    const [description, setDescription] = useState("");
    const [selectedName, setSelectedName] = useState("");
    const [selectedEntry, setSelectedEntry] = useState<
      CatalogComponentEntry | undefined
    >();
    const [selectedPredicateName, setSelectedPredicateName] = useState("");
    const [selectedPredicateEntry, setSelectedPredicateEntry] = useState<
      CatalogComponentEntry | undefined
    >();
    const [predicateNegate, setPredicateNegate] = useState(false);
    const [schemaValues, setSchemaValues] = useState<Record<string, string>>(
      {}
    );
    const [predicateValues, setPredicateValues] = useState<
      Record<string, string>
    >({});
    const [errors, setErrors] = useState<Record<string, string | undefined>>(
      {}
    );

    // Transform typeahead state
    const [isTransformOpen, setIsTransformOpen] = useState(false);
    const [transformInput, setTransformInput] = useState("");
    const [transformFilter, setTransformFilter] = useState("");
    const transformInputRef = useRef<HTMLInputElement>(null);

    // Predicate typeahead state
    const [isPredicateOpen, setIsPredicateOpen] = useState(false);
    const [predicateInput, setPredicateInput] = useState("");
    const [predicateFilter, setPredicateFilter] = useState("");
    const predicateInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      activeSectionRef.current = activeSection;
    }, [activeSection]);

    const {
      data: catalog,
      isLoading: isCatalogLoading,
      error: catalogError,
    } = useQuery<CatalogApiResponse, Error>("componentCatalog", () =>
      fetchData<CatalogApiResponse>(`${API_URL}/api/catalog`)
    );

    const transformations = useMemo(
      () => catalog?.components?.transformation ?? [],
      [catalog]
    );
    const predicates = useMemo(
      () => catalog?.components?.predicate ?? [],
      [catalog]
    );

    const uniqueNames = useMemo(
      () => getUniqueTransformNames(transformations),
      [transformations]
    );

    const variants = useMemo(
      () =>
        selectedName
          ? getVariantsForName(transformations, selectedName)
          : [],
      [transformations, selectedName]
    );

    const showVariantRadios = variants.length > 1;

    const uniquePredicateNames = useMemo(
      () => getUniqueCatalogNames(predicates),
      [predicates]
    );

    const predicateVariants = useMemo(
      () =>
        selectedPredicateName
          ? getVariantsForName(predicates, selectedPredicateName)
          : [],
      [predicates, selectedPredicateName]
    );

    const showPredicateVariantRadios = predicateVariants.length > 1;

    const transformDescriptor = selectedEntry
      ? descriptorPath(selectedEntry.descriptor)
      : null;

    const selectedPredicateClass = selectedPredicateEntry?.class ?? "";

    const predicateDescriptor = selectedPredicateEntry
      ? descriptorPath(selectedPredicateEntry.descriptor)
      : null;

    const {
      data: transformSchema,
      isLoading: isTransformSchemaLoading,
      error: transformSchemaError,
    } = useQuery<ConnectorSchema, Error>(
      ["transformSchema", transformDescriptor],
      () =>
        fetchData<ConnectorSchema>(
          `${API_URL}/api/catalog/${transformDescriptor}`
        ),
      { enabled: !!transformDescriptor }
    );

    const {
      data: predicateSchema,
      isLoading: isPredicateSchemaLoading,
      error: predicateSchemaError,
    } = useQuery<ConnectorSchema, Error>(
      ["predicateSchema", predicateDescriptor],
      () =>
        fetchData<ConnectorSchema>(
          `${API_URL}/api/catalog/${predicateDescriptor}`
        ),
      { enabled: !!predicateDescriptor }
    );

    // Hydrate from initial transform (edit)
    useLayoutEffect(() => {
      if (!initialTransform || transformations.length === 0) {
        return;
      }
      if (hydratedIdRef.current === initialTransform.id) {
        return;
      }
      hydratedIdRef.current = initialTransform.id;

      const entry = findEntryByClass(transformations, initialTransform.type);
      /* eslint-disable react-hooks/set-state-in-effect */
      setTransformName(initialTransform.name);
      setDescription(initialTransform.description ?? "");
      if (entry) {
        setSelectedName(entry.name);
        setSelectedEntry(entry);
        setTransformInput(entry.name);
      } else {
        setSelectedName(initialTransform.type);
        setTransformInput(initialTransform.type);
        setSelectedEntry({
          class: initialTransform.type,
          name: initialTransform.type,
          description: "",
          descriptor: `transformation/${initialTransform.type}.json`,
        });
      }

      const config = (initialTransform.config || {}) as Record<string, string>;
      const stringConfig: Record<string, string> = {};
      for (const [k, v] of Object.entries(config)) {
        stringConfig[k] = v == null ? "" : String(v);
      }
      initialSchemaValuesRef.current = { ...stringConfig };
      setSchemaValues(stringConfig);

      if (initialTransform.predicate?.type) {
        const pEntry = findEntryByClass(
          predicates,
          initialTransform.predicate.type
        );
        if (pEntry) {
          setSelectedPredicateName(pEntry.name);
          setSelectedPredicateEntry(pEntry);
          setPredicateInput(pEntry.name);
        } else {
          setSelectedPredicateName(initialTransform.predicate.type);
          setSelectedPredicateEntry({
            class: initialTransform.predicate.type,
            name: initialTransform.predicate.type,
            description: "",
            descriptor: `predicate/${initialTransform.predicate.type}.json`,
          });
          setPredicateInput(initialTransform.predicate.type);
        }
        setPredicateNegate(!!initialTransform.predicate.negate);
        const pConfig = initialTransform.predicate.config || {};
        const stringPConfig: Record<string, string> = {};
        for (const [k, v] of Object.entries(pConfig)) {
          stringPConfig[k] = v == null ? "" : String(v);
        }
        initialPredicateValuesRef.current = { ...stringPConfig };
        setPredicateValues(stringPConfig);
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    }, [initialTransform, transformations, predicates]);

    const orderedGroups = useMemo(
      () =>
        transformSchema
          ? [...transformSchema.groups].sort((a, b) => a.order - b.order)
          : [],
      [transformSchema]
    );

    const groupedProperties = useMemo(
      () =>
        transformSchema
          ? buildGroupedSchemaProperties(transformSchema.properties)
          : new Map<string, SchemaProperty[]>(),
      [transformSchema]
    );

    const dependencyMap = useMemo(
      () =>
        transformSchema
          ? buildDependencyMap(transformSchema.properties)
          : new Map(),
      [transformSchema]
    );

    const allDependants = useMemo(
      () =>
        transformSchema
          ? collectAllDependants(transformSchema.properties)
          : new Set<string>(),
      [transformSchema]
    );

    const effectiveSchemaValues = useMemo(
      () =>
        transformSchema
          ? buildEffectiveSchemaValues(
              transformSchema.properties,
              schemaValues
            )
          : schemaValues,
      [transformSchema, schemaValues]
    );

    const predicateOrderedGroups = useMemo(
      () =>
        predicateSchema
          ? [...predicateSchema.groups].sort((a, b) => a.order - b.order)
          : [],
      [predicateSchema]
    );

    const predicateGroupedProperties = useMemo(
      () =>
        predicateSchema
          ? buildGroupedSchemaProperties(predicateSchema.properties)
          : new Map<string, SchemaProperty[]>(),
      [predicateSchema]
    );

    const predicateDependencyMap = useMemo(
      () =>
        predicateSchema
          ? buildDependencyMap(predicateSchema.properties)
          : new Map(),
      [predicateSchema]
    );

    const predicateAllDependants = useMemo(
      () =>
        predicateSchema
          ? collectAllDependants(predicateSchema.properties)
          : new Set<string>(),
      [predicateSchema]
    );

    const effectivePredicateValues = useMemo(
      () =>
        predicateSchema
          ? buildEffectiveSchemaValues(
              predicateSchema.properties,
              predicateValues
            )
          : predicateValues,
      [predicateSchema, predicateValues]
    );

    const allSections = useMemo(() => {
      const sections: { id: string; label: string }[] = [
        {
          id: "transform-essentials",
          label: t("transform:jumplinks.essentials", {
            defaultValue: "Transform Essentials",
          }),
        },
        {
          id: "transform-configuration",
          label: t("transform:jumplinks.configuration", {
            defaultValue: "Transform Configuration",
          }),
        },
        {
          id: "transform-predicate",
          label: t("transform:jumplinks.predicate", {
            defaultValue: "Predicate",
          }),
        },
      ];
      return sections;
    }, [t]);

    useEffect(() => {
      const sectionIds = allSections.map((s) => s.id);
      const elements = sectionIds
        .map((id) => document.getElementById(id))
        .filter(Boolean) as HTMLElement[];
      if (elements.length === 0) return;

      const intersecting = new Set<string>();
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) intersecting.add(entry.target.id);
            else intersecting.delete(entry.target.id);
          }
          const topmost = sectionIds.find((id) => intersecting.has(id));
          if (topmost && topmost !== activeSectionRef.current) {
            setActiveSection(topmost);
          }
        },
        { rootMargin: "0px 0px -60% 0px", threshold: 0 }
      );
      for (const el of elements) observer.observe(el);
      return () => observer.disconnect();
    }, [allSections, selectedEntry, selectedPredicateEntry]);

    const filteredUniqueNames = useMemo(() => {
      if (!transformFilter) return uniqueNames;
      const q = transformFilter.toLowerCase();
      return uniqueNames.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          getVariantsForName(transformations, item.name).some(
            (v) =>
              v.class.toLowerCase().includes(q) ||
              v.description.toLowerCase().includes(q)
          )
      );
    }, [uniqueNames, transformFilter, transformations]);

    const filteredPredicateNames = useMemo(() => {
      if (!predicateFilter) return uniquePredicateNames;
      const q = predicateFilter.toLowerCase();
      return uniquePredicateNames.filter(
        (name) =>
          name.toLowerCase().includes(q) ||
          getVariantsForName(predicates, name).some(
            (v) =>
              v.class.toLowerCase().includes(q) ||
              v.description.toLowerCase().includes(q)
          )
      );
    }, [uniquePredicateNames, predicateFilter, predicates]);

    const selectTransformName = (name: string) => {
      const nextVariants = getVariantsForName(transformations, name);
      const next = pickDefaultVariant(nextVariants);
      setSelectedName(name);
      setSelectedEntry(next);
      setTransformInput(name);
      setTransformFilter("");
      setIsTransformOpen(false);
      setSchemaValues({});
      initialSchemaValuesRef.current = {};
      setErrors((e) => ({
        ...e,
        "transform-class": undefined,
        "transform-variant": undefined,
      }));
    };

    const selectPredicateName = (name: string) => {
      const nextVariants = getVariantsForName(predicates, name);
      const next = pickDefaultVariant(nextVariants);
      setSelectedPredicateName(name);
      setSelectedPredicateEntry(next);
      setPredicateInput(name);
      setPredicateFilter("");
      setIsPredicateOpen(false);
      setPredicateValues({});
      initialPredicateValuesRef.current = {};
      setErrors((e) => {
        const nextErrors = { ...e };
        for (const key of Object.keys(nextErrors)) {
          if (key.startsWith("predicate")) delete nextErrors[key];
        }
        return nextErrors;
      });
    };

    const clearPredicate = () => {
      setSelectedPredicateName("");
      setSelectedPredicateEntry(undefined);
      setPredicateInput("");
      setPredicateFilter("");
      setPredicateNegate(false);
      setPredicateValues({});
      initialPredicateValuesRef.current = {};
    };

    const handleSchemaFieldChange = useCallback((name: string, value: string) => {
      setSchemaValues((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [`config:${name}`]: undefined, [name]: undefined }));
    }, []);

    const handlePredicateFieldChange = useCallback(
      (name: string, value: string) => {
        setPredicateValues((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({
          ...prev,
          [`predicate:${name}`]: undefined,
          [name]: undefined,
        }));
      },
      []
    );

    const validate = useCallback((): boolean => {
      const newErrors: Record<string, string | undefined> = {};

      if (!selectedEntry) {
        newErrors["transform-class"] = t("transform:form.classRequired", {
          defaultValue: "Transform class is required",
        });
      }
      if (!transformName.trim()) {
        newErrors["transform-name"] = t("transform:form.nameRequired", {
          defaultValue: "Transform name is required",
        });
      } else if (
        Array.isArray(existingNames) &&
        existingNames.includes(transformName.trim())
      ) {
        const isEditing =
          initialTransform && initialTransform.name === transformName.trim();
        if (!isEditing) {
          newErrors["transform-name"] = t("transform:form.nameExists", {
            defaultValue: "Transform with name '{{name}}' already exists",
            name: transformName.trim(),
          });
        }
      }

      if (transformSchema) {
        for (const prop of transformSchema.properties) {
          if (prop.required && !effectiveSchemaValues[prop.name]?.trim()) {
            if (!allDependants.has(prop.name)) {
              newErrors[prop.name] = `${prop.display.label} is required`;
              newErrors[`config:${prop.name}`] = newErrors[prop.name];
            }
          }
        }
      }

      if (predicateSchema) {
        for (const prop of predicateSchema.properties) {
          if (prop.required && !effectivePredicateValues[prop.name]?.trim()) {
            if (!predicateAllDependants.has(prop.name)) {
              newErrors[prop.name] = `${prop.display.label} is required`;
              newErrors[`predicate:${prop.name}`] = newErrors[prop.name];
            }
          }
        }
      }

      setErrors(newErrors);
      const valid = !Object.values(newErrors).some(Boolean);

      if (!valid) {
        const sections = collectValidationSections(newErrors, t);
        lastValidationFailureBodyRef.current =
          sections.length === 0
            ? t("transform:form.validationFailedGeneric", {
                defaultValue: "Please fill all required fields.",
              })
            : sections.length === 1
              ? t("transform:form.validationFailedInOneSection", {
                  defaultValue: "Please fix errors in {{section}}.",
                  section: sections[0],
                })
              : t("transform:form.validationFailedInMultipleSections", {
                  defaultValue: "Please fix errors in: {{list}}.",
                  list: sections.join(", "),
                });

        const target =
          newErrors["transform-class"] || newErrors["transform-name"]
            ? newErrors["transform-class"]
              ? "transform-class-select"
              : "transform-name"
            : null;
        if (target) {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => scrollIntoViewById(target))
          );
        }
      } else {
        lastValidationFailureBodyRef.current = "";
      }

      return valid;
    }, [
      selectedEntry,
      transformName,
      existingNames,
      initialTransform,
      transformSchema,
      effectiveSchemaValues,
      allDependants,
      predicateSchema,
      effectivePredicateValues,
      predicateAllDependants,
      t,
    ]);

    const getLastValidationFailureBody = useCallback(
      () =>
        lastValidationFailureBodyRef.current ||
        t("transform:form.validationFailedGeneric", {
          defaultValue: "Please fill all required fields.",
        }),
      [t]
    );

    const handleSubmit = useCallback(() => {
      if (!validate()) {
        addNotification(
          "danger",
          "Validation failed",
          getLastValidationFailureBody()
        );
        return;
      }
      if (!selectedEntry) return;

      const config = transformSchema
        ? buildSchemaConfigPayload({
            properties: transformSchema.properties,
            schemaValues,
            initialSchemaValues: initialSchemaValuesRef.current,
            isEdit: !!initialTransform,
            tableManagedIncludeListNames: new Set(),
          })
        : { ...schemaValues };

      const payload: TransformPayload = {
        name: transformName.trim(),
        description,
        type: selectedEntry.class,
        schema: initialTransform?.schema ?? "schema321",
        vaults: initialTransform?.vaults ?? [],
        config,
      };

      if (selectedPredicateClass) {
        const predicateConfig = predicateSchema
          ? buildSchemaConfigPayload({
              properties: predicateSchema.properties,
              schemaValues: predicateValues,
              initialSchemaValues: initialPredicateValuesRef.current,
              isEdit: !!initialTransform?.predicate,
              tableManagedIncludeListNames: new Set(),
            })
          : { ...predicateValues };

        payload.predicate = {
          type: selectedPredicateClass,
          config: predicateConfig,
          negate: predicateNegate,
        };
      }

      onSubmit(payload);
    }, [
      validate,
      addNotification,
      getLastValidationFailureBody,
      selectedEntry,
      transformSchema,
      schemaValues,
      initialTransform,
      transformName,
      description,
      selectedPredicateClass,
      predicateSchema,
      predicateValues,
      predicateNegate,
      onSubmit,
    ]);

    React.useImperativeHandle(
      ref,
      () => ({ validate, submit: handleSubmit, getLastValidationFailureBody }),
      [validate, handleSubmit, getLastValidationFailureBody]
    );

    const transformToggle = (toggleRef: React.Ref<MenuToggleElement>) => (
      <MenuToggle
        ref={toggleRef}
        variant="typeahead"
        onClick={() => {
          setIsTransformOpen(!isTransformOpen);
          transformInputRef.current?.focus();
        }}
        isExpanded={isTransformOpen}
        isFullWidth
        status={errors["transform-class"] ? "danger" : undefined}
        isDisabled={!!initialTransform}
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={transformInput}
            onClick={() => !isTransformOpen && setIsTransformOpen(true)}
            onChange={(_e, value) => {
              setTransformInput(value);
              setTransformFilter(value);
              if (value !== selectedName) {
                setSelectedName("");
                setSelectedEntry(undefined);
              }
              if (value && !isTransformOpen) setIsTransformOpen(true);
            }}
            id="transform-class-input"
            autoComplete="off"
            innerRef={transformInputRef}
            placeholder={t("transform:form.classPlaceholder", {
              defaultValue: "Select a transform",
            })}
            role="combobox"
            isExpanded={isTransformOpen}
            readOnly={!!initialTransform}
            {...(initialTransform
              ? { readOnlyVariant: "plain" as const }
              : {})}
          />
          <TextInputGroupUtilities
            {...(!transformInput || initialTransform
              ? { style: { display: "none" } }
              : {})}
          >
            <Button
              variant="plain"
              onClick={() => {
                setSelectedName("");
                setSelectedEntry(undefined);
                setTransformInput("");
                setTransformFilter("");
                setSchemaValues({});
                transformInputRef.current?.focus();
              }}
              aria-label="Clear"
              icon={<TimesIcon />}
            />
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    );

    const predicateToggle = (toggleRef: React.Ref<MenuToggleElement>) => (
      <MenuToggle
        ref={toggleRef}
        variant="typeahead"
        onClick={() => {
          setIsPredicateOpen(!isPredicateOpen);
          predicateInputRef.current?.focus();
        }}
        isExpanded={isPredicateOpen}
        isFullWidth
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={predicateInput}
            onClick={() => !isPredicateOpen && setIsPredicateOpen(true)}
            onChange={(_e, value) => {
              setPredicateInput(value);
              setPredicateFilter(value);
              if (value !== selectedPredicateName) {
                setSelectedPredicateName("");
                setSelectedPredicateEntry(undefined);
              }
              if (value && !isPredicateOpen) setIsPredicateOpen(true);
            }}
            id="predicate-type-input"
            autoComplete="off"
            innerRef={predicateInputRef}
            placeholder={t("transform:form.predicatePlaceholder", {
              defaultValue: "Select a predicate (optional)",
            })}
            role="combobox"
            isExpanded={isPredicateOpen}
          />
          <TextInputGroupUtilities
            {...(!predicateInput ? { style: { display: "none" } } : {})}
          >
            <Button
              variant="plain"
              onClick={clearPredicate}
              aria-label="Clear predicate"
              icon={<TimesIcon />}
            />
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    );

    const renderEssentials = () => (
      <Form isWidthLimited>
        <FormGroup
          label={t("transform:form.classField")}
          isRequired
          fieldId="transform-class-field"
          labelHelp={
            <Popover bodyContent={t("transform:form.classFieldHelper")}>
              <FormGroupLabelHelp aria-label="More info for transform class" />
            </Popover>
          }
        >
          <Select
            id="transform-class-select"
            isOpen={isTransformOpen}
            selected={selectedName}
            onSelect={(_e, value) => {
              if (value && value !== "no-results") {
                selectTransformName(String(value));
              }
            }}
            onOpenChange={(open) => !open && setIsTransformOpen(false)}
            toggle={transformToggle}
            variant="typeahead"
            isScrollable
            maxMenuHeight="320px"
          >
            <SelectList id="transform-class-listbox">
              {isCatalogLoading ? (
                <>
                  <SelectOption isDisabled>
                    <Skeleton />
                  </SelectOption>
                  <SelectOption isDisabled>
                    <Skeleton />
                  </SelectOption>
                </>
              ) : filteredUniqueNames.length === 0 ? (
                <SelectOption
                  isAriaDisabled
                  value="no-results"
                  children={`No results found for "${transformFilter}"`}
                />
              ) : (
                TRANSFORM_CATALOG_GROUPS.map((group) => {
                  const items = filteredUniqueNames.filter(
                    (n) => n.groupId === group.id
                  );
                  if (items.length === 0) return null;
                  return (
                    <SelectGroup key={group.id} label={group.label}>
                      {items.map((item) => (
                        <SelectOption key={item.name} value={item.name}>
                          {item.name}
                        </SelectOption>
                      ))}
                    </SelectGroup>
                  );
                })
              )}
            </SelectList>
          </Select>
          {errors["transform-class"] && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                  {errors["transform-class"]}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>

        {showVariantRadios && (
          <FormGroup
            label={t("transform:form.variantField", { defaultValue: "Variant" })}
            isRequired
            fieldId="transform-variant"
            labelHelp={
              <Popover
                bodyContent={t("transform:form.variantFieldHelper", {
                  defaultValue:
                    "Select the implementation flavor for this transform.",
                })}
              >
                <FormGroupLabelHelp aria-label="More info for variant" />
              </Popover>
            }
          >
            <div className="transform-variant-radios">
              {variants.map((variant) => (
                <Radio
                  key={variant.class}
                  id={`variant-${variant.class}`}
                  name="transform-variant"
                  label={getVariantLabel(variant)}
                  description={variant.class}
                  isChecked={selectedEntry?.class === variant.class}
                  isDisabled={!!initialTransform}
                  onChange={() => {
                    setSelectedEntry(variant);
                    setSchemaValues({});
                    initialSchemaValuesRef.current = {};
                  }}
                />
              ))}
            </div>
          </FormGroup>
        )}

        <FormGroup
          label={t("transform:form.nameField")}
          isRequired
          fieldId="transform-name-field"
        >
          <TextInput
            id="transform-name"
            value={transformName}
            onChange={(_e, val) => {
              setTransformName(val);
              setErrors((e) => ({ ...e, "transform-name": undefined }));
            }}
            validated={errors["transform-name"] ? "error" : "default"}
          />
          {errors["transform-name"] && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                  {errors["transform-name"]}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>

        <FormGroup
          label={t("transform:form.descriptionField")}
          fieldId="transform-description-field"
        >
          <TextInput
            id="transform-description"
            value={description}
            onChange={(_e, val) => setDescription(val)}
          />
        </FormGroup>
      </Form>
    );

    const renderSchemaGroup = (
      groupName: string,
      grouped: Map<string, SchemaProperty[]>,
      values: Record<string, string>,
      onChange: (name: string, value: string) => void,
      deps: Map<string, Map<string, string[]>>,
      dependants: Set<string>,
      allValues: Record<string, string>
    ) => {
      const props = grouped.get(groupName);
      if (!props || props.length === 0) return null;
      return (
        <SchemaGroupSection
          properties={props}
          values={values}
          onChange={onChange}
          errors={errors}
          allValues={allValues}
          dependencyMap={deps}
          allDependantNames={dependants}
        />
      );
    };

    const renderConfiguration = () => {
      if (!selectedEntry) {
        return (
          <Alert
            variant="info"
            isInline
            title={t("transform:form.selectClassFirst", {
              defaultValue: "Select a transform class to configure its properties.",
            })}
          />
        );
      }
      if (isTransformSchemaLoading) {
        return (
          <div>
            <Skeleton fontSize="md" width="60%" />
            <br />
            <Skeleton fontSize="md" width="80%" />
            <br />
            <Skeleton fontSize="md" width="50%" />
          </div>
        );
      }
      if (transformSchemaError) {
        return (
          <Alert
            variant="danger"
            isInline
            title={t("transform:form.schemaLoadFailed", {
              defaultValue: "Failed to load transform configuration schema",
            })}
          >
            {transformSchemaError.message}
          </Alert>
        );
      }
      if (!transformSchema) return null;

      if (orderedGroups.length === 0) {
        // Schema with no groups — render all properties in one section
        return (
          <SchemaGroupSection
            properties={transformSchema.properties}
            values={schemaValues}
            onChange={handleSchemaFieldChange}
            errors={errors}
            allValues={effectiveSchemaValues}
            dependencyMap={dependencyMap}
            allDependantNames={allDependants}
          />
        );
      }

      const visibleGroups = orderedGroups.filter((group) => {
        const props = groupedProperties.get(group.name);
        return !!props && props.length > 0;
      });
      const hideGroupHeaders = visibleGroups.length <= 1;

      return (
        <>
          {visibleGroups.map((group: SchemaGroup) => (
            <div
              key={group.name}
              style={{ marginBottom: hideGroupHeaders ? 0 : "1.5rem" }}
            >
              {!hideGroupHeaders && (
                <>
                  <Content component="h3" style={{ marginBottom: "0.5rem" }}>
                    {group.name}
                  </Content>
                  {group.description && (
                    <Content
                      component="p"
                      className="jumplinks-section-description"
                    >
                      {group.description}
                    </Content>
                  )}
                </>
              )}
              {renderSchemaGroup(
                group.name,
                groupedProperties,
                schemaValues,
                handleSchemaFieldChange,
                dependencyMap,
                allDependants,
                effectiveSchemaValues
              )}
            </div>
          ))}
        </>
      );
    };

    const renderPredicateConfig = () => {
      if (!selectedPredicateClass) return null;
      if (isPredicateSchemaLoading) {
        return (
          <div style={{ marginTop: "1rem" }}>
            <Skeleton fontSize="md" width="60%" />
            <br />
            <Skeleton fontSize="md" width="40%" />
          </div>
        );
      }
      if (predicateSchemaError) {
        return (
          <Alert
            variant="danger"
            isInline
            title={t("transform:form.predicateSchemaLoadFailed", {
              defaultValue: "Failed to load predicate configuration schema",
            })}
            style={{ marginTop: "1rem" }}
          >
            {predicateSchemaError.message}
          </Alert>
        );
      }
      if (!predicateSchema) return null;

      if (predicateOrderedGroups.length === 0) {
        return (
          <div style={{ marginTop: "1rem" }}>
            <SchemaGroupSection
              properties={predicateSchema.properties}
              values={predicateValues}
              onChange={handlePredicateFieldChange}
              errors={errors}
              allValues={effectivePredicateValues}
              dependencyMap={predicateDependencyMap}
              allDependantNames={predicateAllDependants}
            />
          </div>
        );
      }

      const visiblePredicateGroups = predicateOrderedGroups.filter((group) => {
        const props = predicateGroupedProperties.get(group.name);
        return !!props && props.length > 0;
      });
      const hidePredicateGroupHeaders = visiblePredicateGroups.length <= 1;

      return (
        <div style={{ marginTop: "1rem" }}>
          {visiblePredicateGroups.map((group) => (
            <div
              key={group.name}
              style={{
                marginBottom: hidePredicateGroupHeaders ? 0 : "1rem",
              }}
            >
              {!hidePredicateGroupHeaders && (
                <Content component="h3">{group.name}</Content>
              )}
              {renderSchemaGroup(
                group.name,
                predicateGroupedProperties,
                predicateValues,
                handlePredicateFieldChange,
                predicateDependencyMap,
                predicateAllDependants,
                effectivePredicateValues
              )}
            </div>
          ))}
        </div>
      );
    };

    const renderPredicate = () => (
      <Form isWidthLimited>
        <FormGroup
          label={t("transform:form.predicateTypeField")}
          fieldId="predicate-type-field"
          labelHelp={
            <Popover bodyContent={t("transform:form.predicateTypeFieldHelper")}>
              <FormGroupLabelHelp aria-label="More info for predicate type" />
            </Popover>
          }
        >
          <Select
            id="predicate-type-select"
            isOpen={isPredicateOpen}
            selected={selectedPredicateName}
            onSelect={(_e, value) => {
              if (value && value !== "no-results") {
                selectPredicateName(String(value));
              }
            }}
            onOpenChange={(open) => !open && setIsPredicateOpen(false)}
            toggle={predicateToggle}
            variant="typeahead"
            isScrollable
            maxMenuHeight="320px"
          >
            <SelectList id="predicate-type-listbox">
              {isCatalogLoading ? (
                <SelectOption isDisabled>
                  <Skeleton />
                </SelectOption>
              ) : filteredPredicateNames.length === 0 ? (
                <SelectOption
                  isAriaDisabled
                  value="no-results"
                  children={
                    predicateFilter
                      ? `No results found for "${predicateFilter}"`
                      : t("transform:form.noPredicates", {
                          defaultValue: "No predicates available",
                        })
                  }
                />
              ) : (
                filteredPredicateNames.map((name) => (
                  <SelectOption key={name} value={name}>
                    {name}
                  </SelectOption>
                ))
              )}
            </SelectList>
          </Select>
          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                {t("transform:predicates.description")}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>

        {showPredicateVariantRadios && (
          <FormGroup
            label={t("transform:form.variantField", { defaultValue: "Variant" })}
            isRequired
            fieldId="predicate-variant"
            labelHelp={
              <Popover
                bodyContent={t("transform:form.predicateVariantFieldHelper", {
                  defaultValue:
                    "Select the implementation flavor for this predicate.",
                })}
              >
                <FormGroupLabelHelp aria-label="More info for predicate variant" />
              </Popover>
            }
          >
            <div className="transform-variant-radios">
              {predicateVariants.map((variant) => (
                <Radio
                  key={variant.class}
                  id={`predicate-variant-${variant.class}`}
                  name="predicate-variant"
                  label={getVariantLabel(variant)}
                  description={variant.class}
                  isChecked={selectedPredicateEntry?.class === variant.class}
                  onChange={() => {
                    setSelectedPredicateEntry(variant);
                    setPredicateValues({});
                    initialPredicateValuesRef.current = {};
                  }}
                />
              ))}
            </div>
          </FormGroup>
        )}

        {renderPredicateConfig()}

        {selectedPredicateClass && (
          <FormGroup
            label={t("transform:form.negateField")}
            fieldId="predicate-negate"
          >
            <Checkbox
              id="predicate-negate"
              label={t("transform:form.negateField")}
              isChecked={predicateNegate}
              onChange={(_e, checked) => setPredicateNegate(checked)}
              description={t("transform:form.negateFieldDescription")}
            />
          </FormGroup>
        )}
      </Form>
    );

    if (catalogError) {
      return (
        <Alert variant="danger" isInline title="Failed to load catalog">
          {catalogError.message}
        </Alert>
      );
    }

    const renderJumpLinksLayout = () => (
      <div className="jumplinks-layout">
        <div className="jumplinks-sidebar">
          <JumpLinks
            isVertical
            label={t("transform:jumplinks.label", {
              defaultValue: "Form sections",
            })}
            expandable={{ default: "expandable", md: "nonExpandable" }}
          >
            {allSections.map((section) => (
              <JumpLinksItem
                key={section.id}
                href={`#${section.id}`}
                isActive={activeSection === section.id}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveSection(section.id);
                  document
                    .getElementById(section.id)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {section.label}
              </JumpLinksItem>
            ))}
          </JumpLinks>
        </div>
        <div className="jumplinks-content">
          <section id="transform-essentials">
            <Content component="h2" className="jumplinks-section-title">
              {t("transform:jumplinks.essentials", {
                defaultValue: "Transform Essentials",
              })}
            </Content>
            {renderEssentials()}
          </section>

          <section
            id="transform-configuration"
            className="jumplinks-section-bordered"
          >
            <Content component="h2" className="jumplinks-section-title">
              {t("transform:jumplinks.configuration", {
                defaultValue: "Transform Configuration",
              })}
            </Content>
            <Content component="p" className="jumplinks-section-description">
              {t("transform:form.subsectionDescription", {
                defaultValue:
                  "Configure properties for the selected transform.",
              })}
            </Content>
            {renderConfiguration()}
          </section>

          <section
            id="transform-predicate"
            className="jumplinks-section-bordered"
          >
            <Content component="h2" className="jumplinks-section-title">
              {t("transform:jumplinks.predicate", {
                defaultValue: "Predicate",
              })}
            </Content>
            <Content component="p" className="jumplinks-section-description">
              {t("transform:predicates.description")}
            </Content>
            {renderPredicate()}
          </section>
          <div style={{ paddingBottom: "300px" }} />
        </div>
      </div>
    );

    return renderJumpLinksLayout();
  }
);

CreateTransformForm.displayName = "CreateTransformForm";
export default CreateTransformForm;
