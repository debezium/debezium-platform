import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import {
  JumpLinks,
  JumpLinksItem,
  Content,
  Switch,
} from '@patternfly/react-core';
import type { Control, FieldValues } from 'react-hook-form';
import type { NormalizedSchema } from '../types';
import { ConnectorFormGroup } from './ConnectorFormGroup';

export interface AdditionalSection {
  id: string;
  name: string;
  content: React.ReactNode;
}

interface JumpLinksFormLayoutProps {
  schema: NormalizedSchema;
  visibleFields: Set<string>;
  control: Control<FieldValues>;
  essentialsContent?: React.ReactNode;
  expandAllAdvanced?: boolean;
  onExpandAllAdvancedChange?: (expanded: boolean) => void;
  additionalSections?: AdditionalSection[];
}

const PAGE_SCROLLABLE_SELECTOR = '#primary-app-container';
const SCROLL_OFFSET = 100;
const ESSENTIALS_ID = 'group-connector-essentials';

function toAnchorId(groupName: string): string {
  return `group-${groupName.replace(/\s+/g, '-').toLowerCase()}`;
}

function useScrollSpy(sectionIds: string[], scrollableSelector: string, offset: number) {
  const [activeIndex, setActiveIndex] = useState(0);
  const isClickScrolling = useRef(false);

  const handleScroll = useCallback(() => {
    if (isClickScrolling.current) return;

    const scrollable = document.querySelector(scrollableSelector);
    if (!(scrollable instanceof HTMLElement) || sectionIds.length === 0) return;

    const containerTop = scrollable.getBoundingClientRect().top;

    let bestIndex = 0;
    for (let i = sectionIds.length - 1; i >= 0; i--) {
      const el = document.getElementById(sectionIds[i]);
      if (!el) continue;
      const relativeTop = el.getBoundingClientRect().top - containerTop;
      if (relativeTop <= offset) {
        bestIndex = i;
        break;
      }
    }
    setActiveIndex(bestIndex);
  }, [sectionIds, scrollableSelector, offset]);

  useEffect(() => {
    const scrollable = document.querySelector(scrollableSelector);
    if (!(scrollable instanceof HTMLElement)) return;

    scrollable.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => scrollable.removeEventListener('scroll', handleScroll);
  }, [scrollableSelector, handleScroll]);

  const scrollToSection = useCallback((index: number) => {
    const scrollable = document.querySelector(scrollableSelector);
    const el = document.getElementById(sectionIds[index]);
    if (!(scrollable instanceof HTMLElement) || !el) return;

    isClickScrolling.current = true;
    setActiveIndex(index);

    const containerTop = scrollable.getBoundingClientRect().top;
    const elTop = el.getBoundingClientRect().top - containerTop;
    scrollable.scrollBy({ top: elTop - offset, behavior: 'smooth' });

    const onScrollEnd = () => {
      isClickScrolling.current = false;
      scrollable.removeEventListener('scrollend', onScrollEnd);
    };
    scrollable.addEventListener('scrollend', onScrollEnd, { once: true });
    // Fallback in case scrollend doesn't fire
    setTimeout(() => { isClickScrolling.current = false; }, 1000);
  }, [sectionIds, scrollableSelector, offset]);

  return { activeIndex, scrollToSection };
}

export function JumpLinksFormLayout({
  schema,
  visibleFields,
  control,
  essentialsContent,
  expandAllAdvanced,
  onExpandAllAdvancedChange,
  additionalSections = [],
}: JumpLinksFormLayoutProps) {
  const visibleGroups = useMemo(
    () =>
      schema.groups.filter((g) =>
        g.fields.some((f) => visibleFields.has(f.name))
      ),
    [schema.groups, visibleFields]
  );

  const sectionIds = useMemo(() => {
    const ids: string[] = [];
    if (essentialsContent) ids.push(ESSENTIALS_ID);
    for (const group of visibleGroups) ids.push(toAnchorId(group.name));
    for (const section of additionalSections) ids.push(section.id);
    return ids;
  }, [essentialsContent, visibleGroups, additionalSections]);

  const { activeIndex, scrollToSection } = useScrollSpy(
    sectionIds,
    PAGE_SCROLLABLE_SELECTOR,
    SCROLL_OFFSET,
  );

  if (visibleGroups.length === 0 && !essentialsContent) return null;

  let itemIndex = 0;

  return (
    <div style={{ display: 'flex', gap: '4rem' }}>
      <nav
        style={{
          position: 'sticky',
          top: 20,
          alignSelf: 'flex-start',
          minWidth: '180px',
          flexShrink: 0,
          backgroundColor: 'var(--pf-v5-global--BackgroundColor--100)',
          paddingTop: 'var(--pf-v5-global--spacer--md)',
        }}
      >
        <JumpLinks
          isVertical
          label=""
          activeIndex={activeIndex}
          offset={SCROLL_OFFSET}
        >
          {essentialsContent && (() => {
            const idx = itemIndex++;
            return (
              <JumpLinksItem
                href={`#${ESSENTIALS_ID}`}
                isActive={activeIndex === idx}
                onClick={(e) => { e.preventDefault(); scrollToSection(idx); }}
              >
                Connector essentials
              </JumpLinksItem>
            );
          })()}
          {visibleGroups.map((group) => {
            const idx = itemIndex++;
            return (
              <JumpLinksItem
                key={group.name}
                href={`#${toAnchorId(group.name)}`}
                isActive={activeIndex === idx}
                onClick={(e) => { e.preventDefault(); scrollToSection(idx); }}
              >
                {group.name}
              </JumpLinksItem>
            );
          })}
          {additionalSections.map((section) => {
            const idx = itemIndex++;
            return (
              <JumpLinksItem
                key={section.id}
                href={`#${section.id}`}
                isActive={activeIndex === idx}
                onClick={(e) => { e.preventDefault(); scrollToSection(idx); }}
              >
                {section.name}
              </JumpLinksItem>
            );
          })}
        </JumpLinks>
      </nav>

      <div style={{ flex: 1, minWidth: 0 }}>
        {essentialsContent && (
          <section id={ESSENTIALS_ID} style={{ marginBottom: '2rem' }}>
            <Content component="h3" style={{ marginBottom: '0.5rem' }}>
              Connector essentials
            </Content>
            {essentialsContent}
          </section>
        )}

        {visibleGroups.map((group) => (
          <section
            key={group.name}
            id={toAnchorId(group.name)}
            style={{ marginBottom: '2rem' }}
          >
            <Content component="h3" style={{ marginBottom: '0.5rem' }}>
              {group.name}
            </Content>
            <ConnectorFormGroup
              group={group}
              control={control}
              visibleFields={visibleFields}
              expandAllAdvanced={expandAllAdvanced}
            />
          </section>
        ))}

        {additionalSections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            style={{ marginBottom: '2rem' }}
          >
            <Content component="h3" style={{ marginBottom: '0.5rem' }}>
              {section.name}
            </Content>
            {section.content}
          </section>
        ))}
      </div>

      {onExpandAllAdvancedChange && (
        <div
          style={{
            // position: 'sticky',
            top: 20,
            alignSelf: 'flex-start',
            flexShrink: 0,
            paddingTop: 'var(--pf-v5-global--spacer--md)',
          }}
        >
          <Switch
            id="expand-advanced-toggle"
            label="Expand advanced options"
            isChecked={expandAllAdvanced}
            onChange={(_event, checked) => onExpandAllAdvancedChange(checked)}
          />
        </div>
      )}
    </div>
  );
}
