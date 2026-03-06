import { describe, expect, test } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { FieldRenderer } from './FieldRenderer';
import type { NormalizedField } from '../types';

// Render a component that has both useForm and FieldRenderer
function TestForm({
  field,
  defaultValues = {},
}: {
  field: NormalizedField;
  defaultValues?: Record<string, unknown>;
}) {
  const methods = useForm({ defaultValues });
  return (
    <FormProvider {...methods}>
      <form>
        <FieldRenderer field={field} control={methods.control} />
      </form>
    </FormProvider>
  );
}

describe('FieldRenderer', () => {
  test('fieldType text renders TextInput', () => {
    const field: NormalizedField = {
      name: 'topic.prefix',
      fieldType: 'text',
      label: 'Topic prefix',
      description: '',
      group: 'Connection',
      groupOrder: 0,
      width: 'medium',
      importance: 'high',
      required: false,
    };
    render(<TestForm field={field} />);
    expect(screen.getByLabelText('Topic prefix')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Topic prefix')).toHaveAttribute('type', 'text');
  });

  test('fieldType number renders TextInput type number', () => {
    const field: NormalizedField = {
      name: 'database.port',
      fieldType: 'number',
      label: 'Port',
      description: '',
      group: 'Connection',
      groupOrder: 0,
      width: 'short',
      importance: 'high',
      required: false,
    };
    render(<TestForm field={field} />);
    const input = screen.getByLabelText('Port');
    expect(input).toHaveAttribute('type', 'number');
  });

  test('fieldType boolean renders Switch', () => {
    const field: NormalizedField = {
      name: 'flag',
      fieldType: 'boolean',
      label: 'Enable',
      description: '',
      group: 'Connection',
      groupOrder: 0,
      width: 'medium',
      importance: 'low',
      required: false,
    };
    render(<TestForm field={field} />);
    expect(screen.getByLabelText('Enable')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable')).toHaveAttribute('role', 'switch');
  });

  test('fieldType select renders FormSelect with options', () => {
    const field: NormalizedField = {
      name: 'snapshot.mode',
      fieldType: 'select',
      label: 'Snapshot mode',
      description: '',
      group: 'Connector Snapshot',
      groupOrder: 0,
      width: 'short',
      importance: 'low',
      required: false,
      options: [
        { value: 'initial', label: 'initial' },
        { value: 'always', label: 'always' },
      ],
    };
    render(<TestForm field={field} />);
    expect(screen.getByLabelText('Snapshot mode')).toBeInTheDocument();
    const select = screen.getByLabelText('Snapshot mode');
    expect(select.tagName).toBe('SELECT');
  });

  test('fieldType multiInput renders chip group and text input', () => {
    const field: NormalizedField = {
      name: 'list.field',
      fieldType: 'multiInput',
      label: 'List values',
      description: '',
      group: 'Connection',
      groupOrder: 0,
      width: 'long',
      importance: 'low',
      required: false,
    };
    render(<TestForm field={field} />);
    expect(screen.getByPlaceholderText('Type and press Enter')).toBeInTheDocument();
  });

  test('field label is rendered in FormGroup', () => {
    const field: NormalizedField = {
      name: 'test',
      fieldType: 'text',
      label: 'Test Label',
      description: '',
      group: 'G1',
      groupOrder: 0,
      width: 'medium',
      importance: 'low',
      required: false,
    };
    render(<TestForm field={field} />);
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  test('required true sets isRequired on FormGroup', () => {
    const field: NormalizedField = {
      name: 'required.field',
      fieldType: 'text',
      label: 'Required Field',
      description: '',
      group: 'G1',
      groupOrder: 0,
      width: 'medium',
      importance: 'high',
      required: true,
    };
    const { container } = render(<TestForm field={field} />);
    const formGroup = container.querySelector('.pf-v6-c-form__group');
    expect(formGroup).toBeInTheDocument();
    expect(formGroup?.querySelector('.pf-v6-c-form__label-required')).toBeInTheDocument();
  });

  test('width short renders GridItem with correct span', () => {
    const field: NormalizedField = {
      name: 'short',
      fieldType: 'text',
      label: 'Short',
      description: '',
      group: 'G1',
      groupOrder: 0,
      width: 'short',
      importance: 'low',
      required: false,
    };
    const { container } = render(<TestForm field={field} />);
    const gridItem = container.querySelector('.pf-m-4-col');
    expect(gridItem).toBeInTheDocument();
  });

  test('password fields render as type password', () => {
    const field: NormalizedField = {
      name: 'database.password',
      fieldType: 'text',
      label: 'Password',
      description: '',
      group: 'Connection',
      groupOrder: 0,
      width: 'short',
      importance: 'high',
      required: false,
    };
    render(<TestForm field={field} />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
  });

  test('MultiInputField: Enter key adds chip', async () => {
    const field: NormalizedField = {
      name: 'list.field',
      fieldType: 'multiInput',
      label: 'List',
      description: '',
      group: 'G1',
      groupOrder: 0,
      width: 'long',
      importance: 'low',
      required: false,
    };
    render(<TestForm field={field} />);
    const input = screen.getByPlaceholderText('Type and press Enter');
    fireEvent.change(input, { target: { value: 'item1' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('item1')).toBeInTheDocument();
  });

  test('MultiInputField: clicking chip close button removes it', async () => {
    const field: NormalizedField = {
      name: 'list.field',
      fieldType: 'multiInput',
      label: 'List',
      description: '',
      group: 'G1',
      groupOrder: 0,
      width: 'long',
      importance: 'low',
      required: false,
    };
    render(<TestForm field={field} defaultValues={{ 'list.field': 'chip1,chip2' }} />);
    expect(screen.getByText('chip1')).toBeInTheDocument();
    const closeButton = screen.getByLabelText('Close chip1');
    fireEvent.click(closeButton);
    await waitFor(() => {
      expect(screen.queryByText('chip1')).not.toBeInTheDocument();
    });
  });

  test('NumberField: string input is coerced to number', async () => {
    const field: NormalizedField = {
      name: 'port',
      fieldType: 'number',
      label: 'Port',
      description: '',
      group: 'G1',
      groupOrder: 0,
      width: 'short',
      importance: 'low',
      required: false,
    };
    const submitData: { port?: number } = {};
    const TestFormWithSubmit = () => {
      const methods = useForm<{ port?: number }>({ defaultValues: { port: undefined } });
      return (
        <FormProvider {...methods}>
          <form
            onSubmit={methods.handleSubmit((data) => {
              submitData.port = data.port;
            })}
          >
            <FieldRenderer field={field} control={methods.control as never} />
            <button type="submit">Submit</button>
          </form>
        </FormProvider>
      );
    };
    render(<TestFormWithSubmit />);
    const input = screen.getByLabelText('Port');
    await act(async () => {
      fireEvent.change(input, { target: { value: '8080' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Submit'));
    });
    expect(submitData.port).toBe(8080);
    expect(typeof submitData.port).toBe('number');
  });
});
