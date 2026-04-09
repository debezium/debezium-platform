import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  JumpLinks,
  JumpLinksItem,
  Label,
} from "@patternfly/react-core";
import { useTranslation } from "react-i18next";
import type { Source } from "src/apis";
import type { ConnectorSchema, SchemaProperty } from "../apis/types";
import ConnectorImage from "./ComponentImage";
import { getConnectorTypeName } from "@utils/helpers";
import {
  buildDependencyMap,
  collectAllDependants,
  isSchemaFieldVisible,
} from "@utils/connectorSchemaLayout";
import { splitSourceConfigForHydration } from "@utils/sourceConfigSplit";
import { datatype as DatabaseItemsList } from "@utils/Datatype";
import "./CreateSourceSchemaForm.css";
import "./SourceSchemaReviewView.css";

const EMPTY_DISPLAY = "—";

export interface SourceSchemaReviewViewProps {
  source: Source;
  connectorSchema: ConnectorSchema;
  dataType?: string;
}

const ReviewDescriptionList: React.FC<{ children: React.ReactNode; ariaLabel: string }> = ({
  children,
  ariaLabel,
}) => (
  <DescriptionList
    aria-label={ariaLabel}
    isCompact
    columnModifier={{ default: "1Col", lg: "2Col" }}
    className="source-schema-review__dl"
  >
    {children}
  </DescriptionList>
);

function reviewValue(raw: string | undefined): string {
  if (raw === undefined || raw === null) return EMPTY_DISPLAY;
  return raw.trim() === "" ? EMPTY_DISPLAY : raw;
}

/** Option A: empty values muted; set values visually emphasized. */
const ReviewValueSpan: React.FC<{ raw: string | undefined }> = ({ raw }) => {
  const text = reviewValue(raw);
  const unset = text === EMPTY_DISPLAY;
  return (
    <span
      className={
        unset
          ? "source-schema-review__value source-schema-review__value--empty"
          : "source-schema-review__value source-schema-review__value--set"
      }
    >
      {text}
    </span>
  );
};

const SourceSchemaReviewView: React.FC<SourceSchemaReviewViewProps> = ({
  source,
  connectorSchema,
  dataType,
}) => {
  const { t } = useTranslation();
  const typeKey = dataType || source.type;
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
        source.config as Record<string, unknown>,
        schemaPropertyNames
      ),
    [source.config, schemaPropertyNames]
  );

  const orderedGroups = useMemo(
    () => [...connectorSchema.groups].sort((a, b) => a.order - b.order),
    [connectorSchema.groups]
  );

  const groupedProperties = useMemo(() => {
    const map = new Map<string, SchemaProperty[]>();
    for (const prop of connectorSchema.properties) {
      const group = prop.display.group;
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(prop);
    }
    return map;
  }, [connectorSchema.properties]);

  const dependencyMap = useMemo(
    () => buildDependencyMap(connectorSchema.properties),
    [connectorSchema.properties]
  );

  const allDependants = useMemo(
    () => collectAllDependants(connectorSchema.properties),
    [connectorSchema.properties]
  );

  const allSections = useMemo(() => {
    const sections: { id: string; label: string }[] = [
      {
        id: "connector-essentials",
        label: t("source:jumplinks.connectorEssentials", { defaultValue: "Connector Essentials" }),
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
      label: t("source:jumplinks.additionalProperties", { defaultValue: "Additional Properties" }),
    });
    sections.push({
      id: "signal-collections",
      label: t("source:jumplinks.signalCollections", { defaultValue: "Signal Collections" }),
    });
    return sections;
  }, [orderedGroups, groupedProperties, t]);

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

  const schemaRow = (property: SchemaProperty) => {
    const visible = isSchemaFieldVisible(property, schemaValues, dependencyMap);
    if (!visible) return null;

    const raw = schemaValues[property.name] ?? "";
    const isDep = allDependants.has(property.name);

    return (
      <DescriptionListGroup key={property.name}>
        <DescriptionListTerm>
          {property.display.label}
          {isDep ? (
            <Label isCompact color="teal" className="source-schema-review__conditional">
              {t("source:review.conditional", { defaultValue: "Conditional" })}
            </Label>
          ) : null}
        </DescriptionListTerm>
        <DescriptionListDescription>
          <ReviewValueSpan raw={raw} />
          {raw.trim() !== "" && property.display.description ? (
            <Content
              component="small"
              className="source-schema-review__hint source-schema-review__hint--after-value pf-u-text-color-subtle"
            >
              {property.display.description}
            </Content>
          ) : null}
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

  const dataScopeDescription =
    DatabaseItemsList[typeKey?.split(".")?.[3] as keyof typeof DatabaseItemsList]?.join(" and ");

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
          {t("source:review.noVisibleFieldsInGroup", {
            defaultValue: "No fields apply for the current configuration.",
          })}
        </Content>
      );
    }
    return <ReviewDescriptionList ariaLabel={groupName}>{rows}</ReviewDescriptionList>;
  };

  return (
    <div className="jumplinks-layout source-schema-review">
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
              <DescriptionListTerm>{t("form.field.type", { val: "Source" })}</DescriptionListTerm>
              <DescriptionListDescription>
                <span className="source-schema-review__type-row">
                  <ConnectorImage connectorType={typeKey} size={28} />
                  <span className="source-schema-review__value source-schema-review__value--set">
                    {getConnectorTypeName(typeKey)}
                  </span>
                </span>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>{t("form.field.name", { val: "Source" })}</DescriptionListTerm>
              <DescriptionListDescription>
                <ReviewValueSpan raw={source.name} />
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>{t("form.field.description.label")}</DescriptionListTerm>
              <DescriptionListDescription>
                <ReviewValueSpan raw={source.description} />
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>
                {t("connection:link.connectionFieldLabel", { val: "Source" })}
              </DescriptionListTerm>
              <DescriptionListDescription>
                <ReviewValueSpan raw={source.connection?.name} />
              </DescriptionListDescription>
            </DescriptionListGroup>
          </ReviewDescriptionList>

          <Content component="h3" className="source-schema-review__subtitle pf-u-mt-lg pf-u-mb-sm">
            {t("source:create.dataTableTitle", { val: getConnectorTypeName(typeKey) })}
          </Content>
          {dataScopeDescription ? (
            <Content component="p" className="source-schema-review__desc pf-u-mb-md">
              {t("source:create.dataTableDescription", { val: dataScopeDescription })}
            </Content>
          ) : null}
          <ReviewDescriptionList ariaLabel={t("source:review.dataScopeAria", { defaultValue: "Data scope" })}>
            <DescriptionListGroup>
              <DescriptionListTerm>
                {t("source:review.includeSchemas", { defaultValue: "Included schemas / databases" })}
              </DescriptionListTerm>
              <DescriptionListDescription>
                <ReviewValueSpan
                  raw={
                    selectedDataListItems?.schemas?.length
                      ? selectedDataListItems.schemas.join(", ")
                      : undefined
                  }
                />
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>
                {t("source:review.includeTables", { defaultValue: "Included tables / collections" })}
              </DescriptionListTerm>
              <DescriptionListDescription>
                <ReviewValueSpan
                  raw={
                    selectedDataListItems?.tables?.length
                      ? selectedDataListItems.tables.join(", ")
                      : undefined
                  }
                />
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
              {renderSchemaGroupContent(group.name)}
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
                    <code className="source-schema-review__code-key">{row.key}</code>
                  </DescriptionListTerm>
                  <DescriptionListDescription>
                    <ReviewValueSpan raw={row.value} />
                  </DescriptionListDescription>
                </DescriptionListGroup>
              ))}
            </ReviewDescriptionList>
          )}
        </section>

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
      </div>
    </div>
  );
};

export default SourceSchemaReviewView;
