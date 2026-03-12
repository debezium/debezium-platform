import { useForm, type Resolver, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useAtom, useAtomValue } from 'jotai';
import { useMemo, useRef, useEffect, useState } from 'react';
import {
  Form,
  Tabs,
  Tab,
  TabTitleText,
  ActionGroup,
  Button,
  Spinner,
  Alert,
  Content,
  Bullseye,
} from '@patternfly/react-core';
import type { NormalizedSchema } from '../types';
import { useConnectorSchema } from '../hooks/useConnectorSchema';
import { useFieldVisibility } from '../hooks/useFieldVisibility';
import { buildYupSchema } from '../validation/buildYupSchema';
import { ConnectorFormGroup } from './ConnectorFormGroup';
import { JumpLinksFormLayout, type AdditionalSection } from './JumpLinksFormLayout';
import { savedConnectorConfigAtom, rawConnectorSchemaAtom } from '../store/connectorAtoms';
import { NavigationBlocker } from './NavigationBlocker';

interface DynamicConnectorFormProps {
  connectorType: string;
  onSubmit?: (values: Record<string, unknown>) => Promise<void>;
  initialValues?: Record<string, unknown>;
  /** When embedded, hides Save/Reset and syncs config via onConfigChange */
  mode?: 'standalone' | 'embedded';
  layout?: 'tabs' | 'jumplinks';
  essentialsContent?: React.ReactNode;
  /** Called when form values change (embedded mode). Receives only visible field values. */
  onConfigChange?: (config: Record<string, unknown>) => void;
  /** Exposes isDirty to parent for embedded mode navigation guards */
  onDirtyChange?: (dirty: boolean) => void;
  showHeader?: boolean;
  additionalSections?: AdditionalSection[];
}

function getDefaultValuesFromSchema(
  groups: { fields: { name: string; fieldType?: string }[] }[]
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const group of groups) {
    for (const field of group.fields) {
      switch (field.fieldType) {
        case 'number':
          defaults[field.name] = undefined;
          break;
        case 'boolean':
          defaults[field.name] = false;
          break;
        default:
          defaults[field.name] = '';
      }
    }
  }
  return defaults;
}

export function DynamicConnectorForm({
  connectorType,
  onSubmit,
  initialValues = {},
  mode = 'standalone',
  layout = 'tabs',
  essentialsContent,
  onConfigChange,
  onDirtyChange,
  showHeader = true,
  additionalSections,
}: DynamicConnectorFormProps) {
  const { normalizedSchema, isLoading, error, refetch } = useConnectorSchema(connectorType);
  const rawSchema = useAtomValue(rawConnectorSchemaAtom);
  const [savedConfig, setSavedConfig] = useAtom(savedConnectorConfigAtom);
  const [activeTab, setActiveTab] = useState<string | number>(0);
  const [expandAllAdvanced, setExpandAllAdvanced] = useState(false);

  const initialValuesKey = JSON.stringify(initialValues);
  const stableInitialValues = useMemo(
    () => initialValues,
    [initialValuesKey] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const defaultValues = useMemo(() => {
    const fromInitial = stableInitialValues && Object.keys(stableInitialValues).length > 0;
    const fromSaved = savedConfig && Object.keys(savedConfig).length > 0;
    if (fromInitial) return stableInitialValues;
    if (fromSaved) return savedConfig;
    if (normalizedSchema) {
      return getDefaultValuesFromSchema(normalizedSchema.groups);
    }
    return {};
  }, [stableInitialValues, savedConfig, normalizedSchema]);

  const yupSchemaRef = useRef<ReturnType<typeof buildYupSchema> | null>(null);

  const dynamicResolver: Resolver = useMemo(
    () => async (values, context, options) => {
      if (!yupSchemaRef.current) return { values, errors: {} };
      return yupResolver(yupSchemaRef.current)(values, context, options);
    },
    []
  );

  const form = useForm({
    resolver: dynamicResolver,
    shouldUnregister: true,
    defaultValues,
  });

  const { control, handleSubmit, reset, formState } = form;
  const { isSubmitting, isDirty } = formState;

  const isEmbedded = mode === 'embedded';

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const emptySchema: NormalizedSchema = useMemo(
    () => ({
      connectorName: '',
      groups: [],
      visibilityMap: {},
      triggerFields: [],
    }),
    []
  );

  const schemaForVisibility = normalizedSchema ?? emptySchema;
  const visibleFields = useFieldVisibility({
    schema: schemaForVisibility,
    control: control as never,
  });

  const yupSchema = useMemo(() => {
    if (!normalizedSchema) return null;
    return buildYupSchema(normalizedSchema, visibleFields);
  }, [normalizedSchema, visibleFields]);

  useEffect(() => {
    yupSchemaRef.current = yupSchema;
  }, [yupSchema]);

  useEffect(() => {
    if (normalizedSchema && (Object.keys(stableInitialValues).length > 0 || Object.keys(savedConfig).length > 0)) {
      reset(defaultValues);
    }
  }, [normalizedSchema]); // eslint-disable-line react-hooks/exhaustive-deps

  const watchedValues = useWatch({ control });
  const prevConfigRef = useRef<string>('');
  const onConfigChangeRef = useRef(onConfigChange);
  onConfigChangeRef.current = onConfigChange;

  useEffect(() => {
    if (mode !== 'embedded' || !onConfigChangeRef.current || !watchedValues || typeof watchedValues !== 'object') return;

    const filtered = Object.fromEntries(
      Object.entries(watchedValues as Record<string, unknown>).filter(([key]) =>
        visibleFields.has(key)
      )
    );

    const serialized = JSON.stringify(filtered);
    if (serialized === prevConfigRef.current) return;
    prevConfigRef.current = serialized;

    onConfigChangeRef.current(filtered);
  }, [watchedValues, visibleFields, mode]);

  if (isLoading) {
    return (
      <Bullseye>
        <Spinner aria-label="Loading form schema" />
      </Bullseye>
    );
  }

  if (error || !normalizedSchema) {
    return (
      <Alert
        variant="danger"
        title="Failed to load connector configuration"
        actionLinks={
          <Button variant="link" onClick={() => refetch()}>
            Retry
          </Button>
        }
      >
        {error instanceof Error ? error.message : 'An unexpected error occurred while loading the schema.'}
      </Alert>
    );
  }

  const handleFormSubmit = handleSubmit(async (values) => {
    const filteredValues = Object.fromEntries(
      Object.entries(values).filter(([key]) => visibleFields.has(key))
    );
    if (onSubmit) await onSubmit(filteredValues);
    setSavedConfig(filteredValues);
  });

  const handleReset = () => {
    reset(stableInitialValues && Object.keys(stableInitialValues).length > 0 ? stableInitialValues : savedConfig);
  };

  const connectorDisplayName = rawSchema?.name ?? normalizedSchema.connectorName;
  const connectorVersion = rawSchema?.version;

  const header = showHeader && connectorDisplayName ? (
    <div style={{ marginBottom: '1rem' }}>
      <Content component="h3" style={{ marginBottom: 0 }}>
        {connectorDisplayName + " configuration properties"}
      </Content>
      {connectorVersion && (
        <Content component="small" style={{ color: 'var(--pf-t--global--color--nonstatus--gray--default)' }}>
          v{connectorVersion}
        </Content>
      )}
    </div>
  ) : null;
  console.log(header);

  const formContent = (
    <>
      {/* TODO: Will decide later if to keep or remove the header */}
      {/* {header} */}
      {layout === 'jumplinks' ? (
        <JumpLinksFormLayout
          schema={normalizedSchema}
          visibleFields={visibleFields}
          control={control as never}
          essentialsContent={essentialsContent}
          expandAllAdvanced={expandAllAdvanced}
          onExpandAllAdvancedChange={setExpandAllAdvanced}
          additionalSections={additionalSections}
        />
      ) : (
        <>
        <Content component="h3">
          Configuration properties
        </Content>
        <Tabs
          activeKey={activeTab}
          onSelect={(_event, key) => setActiveTab(key as number)}
        >
          {normalizedSchema.groups.map((group, index) => {
            const hasVisibleFields = group.fields.some((f) =>
              visibleFields.has(f.name)
            );
            if (!hasVisibleFields) return null;

            return (
              <Tab
                key={group.name}
                eventKey={index}
                title={<TabTitleText>{group.name}</TabTitleText>}
              >
                <ConnectorFormGroup
                  group={group}
                  control={control as never}
                  visibleFields={visibleFields}
                />
              </Tab>
            );
          })}
        </Tabs>
        </>
      )}
    </>
  );

  if (isEmbedded) {
    const wrapperStyle = layout === 'jumplinks'
      ? { minWidth: 0 }
      : { minWidth: 0, overflow: 'hidden' as const };
    return <div style={wrapperStyle}>{formContent}</div>;
  }

  return (
    <Form onSubmit={handleFormSubmit}>
      {formContent}

      <ActionGroup>
        <Button
          variant="primary"
          type="submit"
          isLoading={isSubmitting}
          isDisabled={!isDirty || isSubmitting}
        >
          Save Configuration
        </Button>
        <Button
          variant="link"
          onClick={handleReset}
          isDisabled={!isDirty || isSubmitting}
        >
          Reset
        </Button>
      </ActionGroup>

      <NavigationBlocker isDirty={isDirty} />
    </Form>
  );
}
