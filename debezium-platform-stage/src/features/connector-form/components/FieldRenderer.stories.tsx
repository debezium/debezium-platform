import type { Meta, StoryObj } from '@storybook/react';
import { useForm, FormProvider } from 'react-hook-form';
import { Grid } from '@patternfly/react-core';
import { FieldRenderer } from './FieldRenderer';
import { useFieldVisibility } from '../hooks/useFieldVisibility';
import { normalizeSchema } from '../utils/normalizeSchema';
import type { RawConnectorSchema } from '../types';
import oracleFixture from '../../../__fixtures__/oracle.json';

const oracleSchema = oracleFixture as RawConnectorSchema;
const normalizedSchema = normalizeSchema(oracleSchema);

const connectionGroup = normalizedSchema.groups.find(
  (g) => g.name === 'Connection'
);
if (!connectionGroup) throw new Error('Connection group not found');

const connectionAdvancedGroup = normalizedSchema.groups.find(
  (g) => g.name === 'Connection Advanced'
);

function ConnectionGroupForm() {
  const methods = useForm({
    defaultValues: {
      'topic.prefix': '',
      'database.hostname': '',
      'database.port': undefined as number | undefined,
      'database.user': '',
      'database.password': '',
      'database.dbname': '',
      'database.query.timeout.ms': undefined as number | undefined,
      'database.pdb.name': '',
      'xstream.out.server.name': '',
      'database.connection.adapter': '',
    },
  });

  return (
    <FormProvider {...methods}>
      <form>
        <Grid hasGutter>
          {connectionGroup!.fields.map((field) => (
            <FieldRenderer
              key={field.name}
              field={field}
              control={methods.control as never}
            />
          ))}
        </Grid>
      </form>
    </FormProvider>
  );
}

function VisibilityToggleDemo({ adapterValue }: { adapterValue: string }) {
  const methods = useForm({
    defaultValues: {
      'database.connection.adapter': adapterValue,
      'xstream.out.server.name': '',
      'openlogreplicator.host': '',
      'log.mining.strategy': '',
    },
  });

  const visibleFields = useFieldVisibility({
    schema: normalizedSchema,
    control: methods.control as never,
  });

  const connectionFields = connectionGroup!.fields.filter((f) =>
    visibleFields.has(f.name)
  );
  const adapterGatedFields =
    connectionAdvancedGroup?.fields.filter((f) => visibleFields.has(f.name)) ??
    [];

  const adapterField = connectionAdvancedGroup?.fields.find(
    (f) => f.name === 'database.connection.adapter'
  );

  return (
    <FormProvider {...methods}>
      <form>
        <Grid hasGutter>
          {adapterField && (
            <FieldRenderer
              field={adapterField}
              control={methods.control as never}
            />
          )}
          {connectionFields.map((field) => (
            <FieldRenderer
              key={field.name}
              field={field}
              control={methods.control as never}
            />
          ))}
          {adapterGatedFields
            .filter((f) => f.name !== 'database.connection.adapter')
            .map((field) => (
              <FieldRenderer
                key={field.name}
                field={field}
                control={methods.control as never}
              />
            ))}
        </Grid>
      </form>
    </FormProvider>
  );
}

const meta = {
  title: 'Connector Form/FieldRenderer',
  component: ConnectionGroupForm,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof ConnectionGroupForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConnectionGroup: Story = {
  render: () => <ConnectionGroupForm />,
  parameters: {
    docs: {
      description: {
        story:
          'All Connection group fields rendered in isolation. Includes text, number, password, and select fields.',
      },
    },
  },
};

type VisibilityStory = StoryObj<typeof meta & { adapterValue: string }>;

export const VisibilityToggle: VisibilityStory = {
  render: (args: { adapterValue?: string }) => (
    <VisibilityToggleDemo
      key={args.adapterValue ?? ''}
      adapterValue={args.adapterValue ?? ''}
    />
  ),
  args: {
    adapterValue: 'logminer',
  },
  argTypes: {
    adapterValue: {
      control: 'select',
      options: ['', 'logminer', 'logminer_unbuffered', 'xstream', 'olr'],
      description: 'Connector adapter value - change to see fields appear/disappear',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Change the adapter value via the control below to watch fields appear and disappear. XStream shows xstream.out.server.name; OLR shows openlogreplicator fields; LogMiner shows log.mining.* fields.',
      },
    },
  },
};
