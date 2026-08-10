import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  FormGroupLabelHelp,
  JumpLinks,
  JumpLinksItem,
  Popover,
  Skeleton,
} from "@patternfly/react-core";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import type { TransformData } from "src/apis";
import { fetchData } from "src/apis";
import { API_URL } from "@utils/constants";
import type {
  CatalogApiResponse,
  ConnectorSchema,
  SchemaProperty,
} from "../apis/types";
import SchemaReviewValue from "./SchemaReviewValue";
import {
  buildDependencyMap,
  buildEffectiveSchemaValues,
  collectAllDependants,
  getSchemaFieldDisplayValue,
  getSchemaFieldReviewState,
  isSchemaFieldVisible,
} from "@utils/connectorSchemaLayout";
import {
  buildGroupedSchemaProperties,
  descriptorPath,
  findEntryByClass,
} from "@utils/transformCatalog";
import { capitalizeLabel } from "@utils/helpers";
import "./CreateSchemaForm.css";
import "./SchemaReviewView.css";

const EMPTY_DISPLAY = "—";

export interface TransformReviewViewProps {
  transform: TransformData;
}

const ReviewDescriptionList: React.FC<{
  children: React.ReactNode;
  ariaLabel: string;
  /** Use a single column when values are long (e.g. FQCN). */
  singleColumn?: boolean;
}> = ({ children, ariaLabel, singleColumn }) => (
  <DescriptionList
    aria-label={ariaLabel}
    isCompact
    columnModifier={
      singleColumn
        ? { default: "1Col" }
        : { default: "1Col", lg: "2Col" }
    }
    className="connector-schema-review__dl"
  >
    {children}
  </DescriptionList>
);

function reviewValue(raw: string | undefined | boolean): string {
  if (raw === undefined || raw === null) return EMPTY_DISPLAY;
  if (typeof raw === "boolean") return String(raw);
  return raw.trim() === "" ? EMPTY_DISPLAY : raw;
}

const ReviewFieldTerm: React.FC<{
  label: string;
  description?: string;
}> = ({ label, description }) => {
  const displayLabel = capitalizeLabel(label);
  return (
    <span className="connector-schema-review__term">
      {displayLabel}
      {description ? (
        <span className="pf-v6-c-form__group-label-help connector-schema-review__term-help">
          <Popover bodyContent={description}>
            <FormGroupLabelHelp aria-label={`More info for ${displayLabel}`} />
          </Popover>
        </span>
      ) : null}
    </span>
  );
};

const ReviewValueSpan: React.FC<{ raw: string | undefined | boolean }> = ({
  raw,
}) => {
  const text = reviewValue(raw);
  const unset = text === EMPTY_DISPLAY;
  return (
    <span
      className={
        unset
          ? "connector-schema-review__value connector-schema-review__value--empty"
          : "connector-schema-review__value connector-schema-review__value--set"
      }
    >
      {text}
    </span>
  );
};

const TransformReviewView: React.FC<TransformReviewViewProps> = ({
  transform,
}) => {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState("transform-essentials");
  const activeSectionRef = useRef(activeSection);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  const { data: catalog } = useQuery<CatalogApiResponse, Error>(
    "componentCatalog",
    () => fetchData<CatalogApiResponse>(`${API_URL}/api/catalog`)
  );

  const entry = useMemo(
    () =>
      findEntryByClass(
        catalog?.components?.transformation ?? [],
        transform.type
      ),
    [catalog, transform.type]
  );

  const transformDescriptor = entry
    ? descriptorPath(entry.descriptor)
    : `transformation/${transform.type}`;

  const predicateType = transform.predicate?.type;

  const predicateEntry = useMemo(() => {
    if (!predicateType) return undefined;
    return findEntryByClass(
      catalog?.components?.predicate ?? [],
      predicateType
    );
  }, [catalog, predicateType]);

  const predicateDescriptor = predicateEntry
    ? descriptorPath(predicateEntry.descriptor)
    : predicateType
      ? `predicate/${predicateType}`
      : null;

  const {
    data: transformSchema,
    isLoading: isSchemaLoading,
    error: schemaError,
  } = useQuery<ConnectorSchema, Error>(
    ["transformSchema", transformDescriptor],
    () =>
      fetchData<ConnectorSchema>(
        `${API_URL}/api/catalog/${transformDescriptor}`
      ),
    { enabled: !!transformDescriptor }
  );

  const { data: predicateSchema, isLoading: isPredicateSchemaLoading } =
    useQuery<ConnectorSchema, Error>(
      ["predicateSchema", predicateDescriptor],
      () =>
        fetchData<ConnectorSchema>(
          `${API_URL}/api/catalog/${predicateDescriptor}`
        ),
      { enabled: !!predicateDescriptor }
    );

  const schemaValues = useMemo(() => {
    const config = (transform.config || {}) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(config)) {
      out[k] = v == null ? "" : String(v);
    }
    return out;
  }, [transform.config]);

  const predicateValues = useMemo(() => {
    const config = (transform.predicate?.config || {}) as Record<
      string,
      unknown
    >;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(config)) {
      out[k] = v == null ? "" : String(v);
    }
    return out;
  }, [transform.predicate?.config]);

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
        ? buildEffectiveSchemaValues(transformSchema.properties, schemaValues)
        : schemaValues,
    [transformSchema, schemaValues]
  );

  const allSections = useMemo(() => {
    const sections = [
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
        for (const entryObs of entries) {
          if (entryObs.isIntersecting) intersecting.add(entryObs.target.id);
          else intersecting.delete(entryObs.target.id);
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
  }, [allSections, transformSchema, predicateSchema]);

  const schemaRow = (property: SchemaProperty) => {
    const visible = isSchemaFieldVisible(
      property,
      effectiveSchemaValues,
      dependencyMap
    );
    if (!visible) return null;

    const raw = getSchemaFieldDisplayValue(property, schemaValues);
    const reviewState = getSchemaFieldReviewState(property, schemaValues);
    const isDep = allDependants.has(property.name);

    return (
      <DescriptionListGroup
        key={property.name}
        className={isDep ? "connector-schema-review__row--dependant" : undefined}
      >
        <DescriptionListTerm>
          <ReviewFieldTerm
            label={property.display.label}
            description={property.display.description}
          />
        </DescriptionListTerm>
        <DescriptionListDescription>
          <SchemaReviewValue
            raw={raw}
            state={reviewState}
            configuredLabel={t("transform:review.configured", {
              defaultValue: "Configured",
            })}
            defaultLabel={t("transform:review.default", {
              defaultValue: "Default",
            })}
          />
        </DescriptionListDescription>
      </DescriptionListGroup>
    );
  };

  const renderSchemaGroupContent = (groupName: string) => {
    const props = groupedProperties.get(groupName);
    if (!props || props.length === 0) return null;
    const rows = [...props]
      .sort((a, b) => a.display.groupOrder - b.display.groupOrder)
      .map(schemaRow)
      .filter(Boolean);
    if (rows.length === 0) {
      return (
        <Content component="p" className="pf-u-text-color-subtle">
          {t("transform:review.noVisibleFields", {
            defaultValue: "No fields apply for the current configuration.",
          })}
        </Content>
      );
    }
    return (
      <ReviewDescriptionList ariaLabel={groupName}>{rows}</ReviewDescriptionList>
    );
  };

  const renderPredicateSchema = () => {
    if (!transform.predicate?.type) {
      return (
        <Content component="p" className="pf-u-text-color-subtle">
          {t("transform:review.noPredicate", {
            defaultValue: "No predicate configured.",
          })}
        </Content>
      );
    }

    if (isPredicateSchemaLoading) {
      return <Skeleton fontSize="md" width="50%" />;
    }

    return (
      <ReviewDescriptionList ariaLabel="Predicate">
        <DescriptionListGroup>
          <DescriptionListTerm>
            <ReviewFieldTerm label={t("transform:form.predicateTypeField")} />
          </DescriptionListTerm>
          <DescriptionListDescription>
            <ReviewValueSpan raw={transform.predicate.type} />
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>
            <ReviewFieldTerm label={t("transform:form.negateField")} />
          </DescriptionListTerm>
          <DescriptionListDescription>
            <ReviewValueSpan raw={!!transform.predicate.negate} />
          </DescriptionListDescription>
        </DescriptionListGroup>
        {predicateSchema?.properties.map((property) => {
          const raw = getSchemaFieldDisplayValue(property, predicateValues);
          const reviewState = getSchemaFieldReviewState(
            property,
            predicateValues
          );
          return (
            <DescriptionListGroup key={property.name}>
              <DescriptionListTerm>
                <ReviewFieldTerm
                  label={property.display.label}
                  description={property.display.description}
                />
              </DescriptionListTerm>
              <DescriptionListDescription>
                <SchemaReviewValue
                  raw={raw}
                  state={reviewState}
                  configuredLabel={t("transform:review.configured", {
                    defaultValue: "Configured",
                  })}
                  defaultLabel={t("transform:review.default", {
                    defaultValue: "Default",
                  })}
                />
              </DescriptionListDescription>
            </DescriptionListGroup>
          );
        })}
        {!predicateSchema &&
          Object.entries(predicateValues).map(([key, value]) => (
            <DescriptionListGroup key={key}>
              <DescriptionListTerm>
                <ReviewFieldTerm label={key} />
              </DescriptionListTerm>
              <DescriptionListDescription>
                <ReviewValueSpan raw={value} />
              </DescriptionListDescription>
            </DescriptionListGroup>
          ))}
      </ReviewDescriptionList>
    );
  };

  return (
    <div className="jumplinks-layout connector-schema-review">
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
          <ReviewDescriptionList ariaLabel="Transform class" singleColumn>
            <DescriptionListGroup className="transformClassRow">
              <DescriptionListTerm>
                <ReviewFieldTerm label={t("transform:form.classField")} />
              </DescriptionListTerm>
              <DescriptionListDescription>
                <ReviewValueSpan raw={transform.type} />
              </DescriptionListDescription>
            </DescriptionListGroup>
          </ReviewDescriptionList>
          <ReviewDescriptionList ariaLabel="Transform essentials" >
            {/* {entry && getVariantLabel(entry) !== "Default" && (
              <DescriptionListGroup>
                <DescriptionListTerm>
                  <ReviewFieldTerm
                    label={t("transform:form.variantField", {
                      defaultValue: "Variant",
                    })}
                  />
                </DescriptionListTerm>
                <DescriptionListDescription>
                  <ReviewValueSpan raw={getVariantLabel(entry)} />
                </DescriptionListDescription>
              </DescriptionListGroup>
            )} */}
            <DescriptionListGroup>
              <DescriptionListTerm>
                <ReviewFieldTerm label={t("transform:form.nameField")} />
              </DescriptionListTerm>
              <DescriptionListDescription>
                <ReviewValueSpan raw={transform.name} />
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>
                <ReviewFieldTerm
                  label={t("transform:form.descriptionField")}
                />
              </DescriptionListTerm>
              <DescriptionListDescription>
                <ReviewValueSpan raw={transform.description} />
              </DescriptionListDescription>
            </DescriptionListGroup>
          </ReviewDescriptionList>
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
          {isSchemaLoading ? (
            <>
              <Skeleton fontSize="md" width="60%" />
              <br />
              <Skeleton fontSize="md" width="80%" />
            </>
          ) : schemaError ? (
            <Alert
              variant="danger"
              isInline
              title={t("transform:form.schemaLoadFailed", {
                defaultValue: "Failed to load transform configuration schema",
              })}
            >
              {schemaError.message}
            </Alert>
          ) : transformSchema ? (
            orderedGroups.length > 0 ? (
              (() => {
                const visibleGroups = orderedGroups.filter((group) => {
                  const props = groupedProperties.get(group.name);
                  return !!props && props.length > 0;
                });
                const hideGroupHeaders = visibleGroups.length <= 1;
                return visibleGroups.map((group) => (
                  <div
                    key={group.name}
                    style={{ marginBottom: hideGroupHeaders ? 0 : "1.5rem" }}
                  >
                    {!hideGroupHeaders && (
                      <>
                        <Content component="h3">{group.name}</Content>
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
                    {renderSchemaGroupContent(group.name)}
                  </div>
                ));
              })()
            ) : (
              <ReviewDescriptionList ariaLabel="Configuration">
                {transformSchema.properties
                  .slice()
                  .sort((a, b) => a.display.groupOrder - b.display.groupOrder)
                  .map(schemaRow)}
              </ReviewDescriptionList>
            )
          ) : (
            <ReviewDescriptionList ariaLabel="Configuration">
              {Object.entries(schemaValues).map(([key, value]) => (
                <DescriptionListGroup key={key}>
                  <DescriptionListTerm>
                    <ReviewFieldTerm label={key} />
                  </DescriptionListTerm>
                  <DescriptionListDescription>
                    <ReviewValueSpan raw={value} />
                  </DescriptionListDescription>
                </DescriptionListGroup>
              ))}
            </ReviewDescriptionList>
          )}
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
          {renderPredicateSchema()}
        </section>
        <div style={{ paddingBottom: "200px" }} />
      </div>
    </div>
  );
};

export default TransformReviewView;
