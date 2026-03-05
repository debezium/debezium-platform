import { useForm, type Resolver, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useAtom } from 'jotai';
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
} from '@patternfly/react-core';
import type { NormalizedSchema } from '../types';
import { useConnectorSchema } from '../hooks/useConnectorSchema';
import { useFieldVisibility } from '../hooks/useFieldVisibility';
import { buildYupSchema } from '../validation/buildYupSchema';
import { ConnectorFormGroup } from './ConnectorFormGroup';
import { savedConnectorConfigAtom } from '../store/connectorAtoms';

interface DynamicConnectorFormProps {
  connectorType: string;
  onSubmit?: (values: Record<string, unknown>) => Promise<void>;
  initialValues?: Record<string, unknown>;
  /** When embedded, hides Save/Reset and syncs config via onConfigChange */
  mode?: 'standalone' | 'embedded';
  /** Called when form values change (embedded mode). Receives only visible field values. */
  onConfigChange?: (config: Record<string, unknown>) => void;
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
  onConfigChange,
}: DynamicConnectorFormProps) {
  const { normalizedSchema, isLoading, error } = useConnectorSchema(connectorType);
  const [savedConfig, setSavedConfig] = useAtom(savedConnectorConfigAtom);
  const [activeTab, setActiveTab] = useState<string | number>(0);

  const defaultValues = useMemo(() => {
    const fromInitial = initialValues && Object.keys(initialValues).length > 0;
    const fromSaved = savedConfig && Object.keys(savedConfig).length > 0;
    if (fromInitial) return initialValues;
    if (fromSaved) return savedConfig;
    if (normalizedSchema) {
      return getDefaultValuesFromSchema(normalizedSchema.groups);
    }
    return {};
  }, [initialValues, savedConfig, normalizedSchema]);

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
    if (normalizedSchema && (Object.keys(initialValues).length > 0 || Object.keys(savedConfig).length > 0)) {
      reset(defaultValues);
    }
  }, [normalizedSchema]); // eslint-disable-line react-hooks/exhaustive-deps

  const watchedValues = useWatch({ control });
  useEffect(() => {
    if (mode === 'embedded' && onConfigChange && watchedValues && typeof watchedValues === 'object') {
      const filtered = Object.fromEntries(
        Object.entries(watchedValues as Record<string, unknown>).filter(([key]) =>
          visibleFields.has(key)
        )
      );
      onConfigChange(filtered);
    }
  }, [watchedValues, visibleFields, mode, onConfigChange]);

  if (isLoading) {
    return <Spinner aria-label="Loading form schema" />;
  }

  if (error || !normalizedSchema) {
    return (
      <Alert
        variant="danger"
        title="Failed to load connector configuration"
      />
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
    reset(initialValues && Object.keys(initialValues).length > 0 ? initialValues : savedConfig);
  };

  const isEmbedded = mode === 'embedded';

  return (
    <Form onSubmit={handleFormSubmit}>
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

      {!isEmbedded && (
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
      )}
    </Form>
  );
}
