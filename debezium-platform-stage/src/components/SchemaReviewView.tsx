import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  FormFieldGroup,
  FormGroupLabelHelp,
  JumpLinks,
  JumpLinksItem,
  Label,
  Popover,
  Skeleton,
} from "@patternfly/react-core";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { useNavigate } from "react-router-dom";
import type { Source, Destination, TableData } from "src/apis";
import { fetchDataCall } from "src/apis";
import { API_URL } from "@utils/constants";
import type { ConnectorSchema, SchemaProperty } from "../apis/types";
import ConnectorImage from "./ComponentImage";
import { getConnectorTypeName } from "@utils/helpers";
import {
  buildDependencyMap,
  buildEffectiveSchemaValues,
  collectAllDependants,
  getSchemaFieldDisplayValue,
  getSchemaFieldReviewState,
  isSchemaFieldVisible,
} from "@utils/connectorSchemaLayout";
import { buildSourceConnectorDisplayGroupedProperties } from "@utils/sourceConnectorDisplayGroups";
import { splitSourceConfigForHydration } from "@utils/sourceConfigSplit";
import {
  getDataExplorerScopePhrase,
  getTableManagedFilterPropertyNames,
} from "@utils/Datatype";
import ApiComponentError from "./ApiComponentError";
import SchemaReviewValue from "./SchemaReviewValue";
import TableViewComponent from "./TableViewComponent";
import _ from "lodash";
import "./CreateSchemaForm.css";
import "./SchemaReviewView.css";

const EMPTY_DISPLAY = "—";

export interface SchemaReviewViewProps {
  connector: Source | Destination;
  connectorSchema: ConnectorSchema;
  dataType?: string;
  connectorType: "source" | "destination";
}

const ReviewDescriptionList: React.FC<{ children: React.ReactNode; ariaLabel: string }> = ({
  children,
  ariaLabel,
}) => (
  <DescriptionList
    aria-label={ariaLabel}
    isCompact
    columnModifier={{ default: "1Col", lg: "2Col" }}
    className="connector-schema-review__dl"
  >
    {children}
  </DescriptionList>
);

function reviewValue(raw: string | undefined): string {
  if (raw === undefined || raw === null) return EMPTY_DISPLAY;
  return raw.trim() === "" ? EMPTY_DISPLAY : raw;
}

const ReviewFieldTerm: React.FC<{
  label: string;
  description?: string;
  suffix?: React.ReactNode;
}> = ({ label, description, suffix }) => (
  <span className="connector-schema-review__term">
    {label}
    {description ? (
      <span className="pf-v6-c-form__group-label-help connector-schema-review__term-help">
        <Popover bodyContent={description}>
          <FormGroupLabelHelp aria-label={`More info for ${label}`} />
        </Popover>
      </span>
    ) : null}
    {suffix}
  </span>
);

/** Non-schema review rows (name, connection, additional props, etc.). */
const ReviewValueSpan: React.FC<{ raw: string | undefined }> = ({ raw }) => {
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

const SchemaReviewView: React.FC<SchemaReviewViewProps> = ({
  connector,
  connectorSchema,
  dataType,
  connectorType,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const typeKey = dataType || connector.type;
  const hideSignalCollections = connectorType === "destination";
  const [activeSection, setActiveSection] = useState("connector-essentials");
  const activeSectionRef = useRef(activeSection);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  const schemaPropertyNames = useMemo(
    () => connectorSchema.properties.map((p) => p.name),
    [connectorSchema.properties]
  );

  const split = useMemo(
    () =>
      splitSourceConfigForHydration(
        connector.config as Record<string, unknown>,
        schemaPropertyNames
      ),
    [connector.config, schemaPropertyNames]
  );

  const orderedGroups = useMemo(
    () => [...connectorSchema.groups].sort((a, b) => a.order - b.order),
    [connectorSchema.groups]
  );

  const groupedProperties = useMemo(
    () => buildSourceConnectorDisplayGroupedProperties(connectorSchema),
    [connectorSchema]
  );

  const dependencyMap = useMemo(
    () => buildDependencyMap(connectorSchema.properties),
    [connectorSchema.properties]
  );

  const allDependants = useMemo(
    () => collectAllDependants(connectorSchema.properties),
    [connectorSchema.properties]
  );

  const connectorTypeString = typeKey;

  const tableManagedFilterNames = useMemo(
    () => new Set(getTableManagedFilterPropertyNames(connectorTypeString)),
    [connectorTypeString]
  );

  const selectedConnectionId = connector.connection?.id;

  const {
    data: collections,
    isLoading: isCollectionsLoading,
    error: collectionsQueryError,
    refetch: refetchCollections,
  } = useQuery<TableData, object>(
    ["connection-collections", selectedConnectionId],
    async () => {
      const response = await fetchDataCall<TableData>(
        `${API_URL}/api/connections/${selectedConnectionId}/collections`
      );
      if (response.error) {
        throw (response.error.body || {}) as object;
      }
      return response.data as TableData;
    },
    {
      enabled: selectedConnectionId != null && !hideSignalCollections,
    }
  );

  const collectionsError =
    collectionsQueryError != null
      ? typeof collectionsQueryError === "object"
        ? (collectionsQueryError as object)
        : { message: String(collectionsQueryError) }
      : undefined;

  const allSections = useMemo(() => {
    const sections: { id: string; label: string }[] = [
      {
        id: "connector-essentials",
        label: t("common:connector.jumplinks.connectorEssentials", { defaultValue: "Connector Essentials" }),
      },
    ];
    for (const group of orderedGroups) {
      const props = groupedProperties.get(group.name);
      if (props && props.length > 0) {
        sections.push({
          id: `group-${group.name.replace(/\s+/g, "-").toLowerCase()}`,
          label: group.name,
        });
      }
    }
    sections.push({
      id: "additional-properties",
      label: t("common:connector.jumplinks.additionalProperties", { defaultValue: "Additional Properties" }),
    });
    if (!hideSignalCollections) {
      sections.push({
        id: "signal-collections",
        label: t("source:jumplinks.signalCollections", { defaultValue: "Signal Collections" }),
      });
    }
    return sections;
  }, [orderedGroups, groupedProperties, t, hideSignalCollections]);

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
          if (entry.isIntersecting) {
            intersecting.add(entry.target.id);
          } else {
            intersecting.delete(entry.target.id);
          }
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
  }, [allSections]);

  const { schemaValues, additionalProps, signalCollectionName, selectedDataListItems } = split;

  const effectiveSchemaValues = useMemo(
    () => buildEffectiveSchemaValues(connectorSchema.properties, schemaValues),
    [connectorSchema.properties, schemaValues]
  );

  const noopSetSelectedDataListItems = useCallback(() => {}, []);

  const renderFiltersTableExplorer = useCallback(() => {
    if (!connector.connection?.id) return null;
    if (isCollectionsLoading) {
      return (
        <FormFieldGroup>
          <Skeleton fontSize="2xl" width="50%" />
          <Skeleton fontSize="md" width="33%" />
        </FormFieldGroup>
      );
    }
    if (!_.isEmpty(collectionsError)) {
      return (
        <FormFieldGroup>
          <ApiComponentError
            error={collectionsError}
            retry={() => {
              void refetchCollections();
            }}
          />
        </FormFieldGroup>
      );
    }
    return (
      <div className="table-explorer-section">
        <Content
          component="h3"
          id="field-group-data-table-id"
          className="table-explorer-section__title"
        >
          {t("source:create.dataTableTitle", {
            val: getConnectorTypeName(connectorTypeString),
          })}
        </Content>
        <Content component="p" className="table-explorer-section__description">
          {t("source:create.dataTableDescription", {
            val: getDataExplorerScopePhrase(connectorTypeString),
          })}
        </Content>
        <TableViewComponent
          collections={collections}
          setSelectedDataListItems={noopSetSelectedDataListItems}
          selectedDataListItems={selectedDataListItems}
          readOnly
        />
      </div>
    );
  }, [
    connector.connection?.id,
    isCollectionsLoading,
    collectionsError,
    collections,
    selectedDataListItems,
    noopSetSelectedDataListItems,
    t,
    connectorTypeString,
    refetchCollections,
  ]);

  const schemaRow = (property: SchemaProperty) => {
    const visible = isSchemaFieldVisible(property, effectiveSchemaValues, dependencyMap);
    if (!visible) return null;

    const raw = getSchemaFieldDisplayValue(property, schemaValues);
    const reviewState = getSchemaFieldReviewState(property, schemaValues);
    const isDep = allDependants.has(property.name);

    return (
      <DescriptionListGroup key={property.name}>
        <DescriptionListTerm>
          <ReviewFieldTerm
            label={property.display.label}
            description={property.display.description}
            suffix={
              isDep ? (
                <Label isCompact color="teal" className="connector-schema-review__conditional">
                  {t("source:review.conditional", { defaultValue: "Conditional" })}
                </Label>
              ) : null
            }
          />
        </DescriptionListTerm>
        <DescriptionListDescription>
          <SchemaReviewValue
            raw={raw}
            state={reviewState}
            configuredLabel={t("source:review.configured", { defaultValue: "Configured" })}
            defaultLabel={t("source:review.default", { defaultValue: "Default" })}
          />
        </DescriptionListDescription>
      </DescriptionListGroup>
    );
  };

  const additionalRows = useMemo(() => {
    const rows = Array.from(additionalProps.values()).sort((a, b) =>
      a.key.localeCompare(b.key)
    );
    return rows;
  }, [additionalProps]);

  const renderSchemaGroupContent = (groupName: string, omittedPropertyNames?: Set<string>) => {
    const props = groupedProperties.get(groupName);
    if (!props || props.length === 0) return null;
    const filtered =
      omittedPropertyNames && omittedPropertyNames.size > 0
        ? props.filter((p) => !omittedPropertyNames.has(p.name))
        : props;
    const rows = [...filtered]
      .sort((a, b) => a.display.groupOrder - b.display.groupOrder)
      .map(schemaRow)
      .filter(Boolean);
    if (rows.length === 0) {
      return (
        <Content component="p" className="pf-u-text-color-subtle">
          {t("source:review.noVisibleFieldsInGroup", {
            defaultValue: "No fields apply for the current configuration.",
          })}
        </Content>
      );
    }
    return <ReviewDescriptionList ariaLabel={groupName}>{rows}</ReviewDescriptionList>;
  };

  return (
    <div className="jumplinks-layout connector-schema-review">
      <div className="jumplinks-sidebar">
        <JumpLinks
          isVertical
          label={t("source:jumplinks.label", { defaultValue: "Form sections" })}
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
                document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {section.label}
            </JumpLinksItem>
          ))}
        </JumpLinks>
      </div>

      <div className="jumplinks-content">
        <section id="connector-essentials">
          <Content component="h2" className="jumplinks-section-title">
            {t("source:review.section.essentials", { defaultValue: "Connector essentials" })}
          </Content>
          <ReviewDescriptionList ariaLabel={t("source:review.essentialsAria", { defaultValue: "Connector essentials" })}>
            <DescriptionListGroup>
              <DescriptionListTerm>{t("form.field.type", { val: connectorType === "source" ? "Source" : "Destination" })}</DescriptionListTerm>
              <DescriptionListDescription>
                <span className="connector-schema-review__type-row">
                  <ConnectorImage connectorType={typeKey} size={28} />
                  <span className="connector-schema-review__value connector-schema-review__value--set">
                    {getConnectorTypeName(typeKey)}
                  </span>
                </span>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>{t("form.field.name", { val: connectorType === "source" ? "Source" : "Destination" })}</DescriptionListTerm>
              <DescriptionListDescription>
                <ReviewValueSpan raw={connector.name} />
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>{t("form.field.description.label")}</DescriptionListTerm>
              <DescriptionListDescription>
                <ReviewValueSpan raw={connector.description} />
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>
                {t("connection:link.connectionFieldLabel", { val: connectorType === "source" ? "Source" : "Destination" })}
              </DescriptionListTerm>
              <DescriptionListDescription>
                {connector.connection?.id && connector.connection?.name ? (
                  <Button
                    variant="link"
                    isInline
                    onClick={() => navigate(`/connections/${connector.connection!.id}?state=view`)}
                  >
                    {connector.connection.name}
                  </Button>
                ) : (
                  <ReviewValueSpan raw={connector.connection?.name} />
                )}
              </DescriptionListDescription>
            </DescriptionListGroup>
          </ReviewDescriptionList>
        </section>

        {orderedGroups.map((group) => {
          const props = groupedProperties.get(group.name);
          if (!props || props.length === 0) return null;
          const sectionId = `group-${group.name.replace(/\s+/g, "-").toLowerCase()}`;
          return (
            <section key={group.name} id={sectionId} className="jumplinks-section-bordered">
              <Content component="h2" className="jumplinks-section-title">
                {group.name}
              </Content>
              <Content component="p" className="jumplinks-section-description">
                {group.description}
              </Content>
              {group.name === "Filters" && tableManagedFilterNames.size > 0 ? renderFiltersTableExplorer() : null}
              {renderSchemaGroupContent(
                group.name,
                group.name === "Filters" && tableManagedFilterNames.size > 0 ? tableManagedFilterNames : undefined
              )}
            </section>
          );
        })}

        <section id="additional-properties" className="jumplinks-section-bordered">
          <Content component="h2" className="jumplinks-section-title">
            {t("source:review.section.additional", { defaultValue: "Additional properties" })}
          </Content>
          <Content component="p" className="jumplinks-section-description">
            {t("source:review.additionalHelp", {
              defaultValue: "Custom keys not defined in the connector schema.",
            })}
          </Content>
          {additionalRows.length === 0 ? (
            <Content component="p" className="pf-u-text-color-subtle">
              {t("source:review.noAdditional", { defaultValue: "No additional properties." })}
            </Content>
          ) : (
            <ReviewDescriptionList
              ariaLabel={t("source:review.section.additional", { defaultValue: "Additional properties" })}
            >
              {additionalRows.map((row, idx) => (
                <DescriptionListGroup key={`${row.key}-${idx}`}>
                  <DescriptionListTerm>
                    <code className="connector-schema-review__code-key">{row.key}</code>
                  </DescriptionListTerm>
                  <DescriptionListDescription>
                    <ReviewValueSpan
                      raw={
                        row.valueKind === "string"
                          ? row.stringValue
                          : row.valueKind === "boolean"
                          ? String(row.booleanValue)
                          : row.integerInput
                      }
                    />
                  </DescriptionListDescription>
                </DescriptionListGroup>
              ))}
            </ReviewDescriptionList>
          )}
        </section>

        {!hideSignalCollections && (
          <section id="signal-collections" className="jumplinks-section-bordered">
            <Content component="h2" className="jumplinks-section-title">
              {t("source:signal.title")}
            </Content>
            <Content component="p" className="jumplinks-section-description">
              {t("source:signal.description")}
            </Content>
            <ReviewDescriptionList ariaLabel={t("source:signal.title")}>
              <DescriptionListGroup>
                <DescriptionListTerm>
                  {t("source:signal.signalingCollectionField.label", {
                    defaultValue: "Signaling collection",
                  })}
                </DescriptionListTerm>
                <DescriptionListDescription>
                  <ReviewValueSpan raw={signalCollectionName} />
                </DescriptionListDescription>
              </DescriptionListGroup>
            </ReviewDescriptionList>
          </section>
        )}
        <div style={{ paddingBottom: "300px" }} />
      </div>
    </div>
  );
};

export default SchemaReviewView;
