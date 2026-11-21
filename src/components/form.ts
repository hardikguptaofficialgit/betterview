import { FormFieldSpec, FormSpec } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';
import { iconEl } from '../core/icons';

function makeField(field: FormFieldSpec, index: number): HTMLElement {
  const wrapper = h('div', { class: `iui-form-field iui-form-field-${field.type}` });
  const controlId = `iui-form-${index}-${field.id}`;
  const label = h('label', { class: 'iui-form-label', for: controlId }, field.label,
    field.required ? h('span', { class: 'iui-form-required', 'aria-label': 'required' }, ' *') : null);
  const attrs: Record<string, string | number | boolean> = {
    id: controlId, name: field.id, class: 'iui-form-control',
    ...(field.required ? { required: true } : {}),
    ...(field.placeholder ? { placeholder: field.placeholder } : {}),
    ...(field.min !== undefined ? { min: field.min } : {}),
    ...(field.max !== undefined ? { max: field.max } : {}),
    ...(field.step !== undefined ? { step: field.step } : {}),
  };
  let control: HTMLElement;
  if (field.type === 'textarea') {
    control = h('textarea', { ...attrs, rows: 3 }) as HTMLTextAreaElement;
    if (typeof field.value === 'string') (control as HTMLTextAreaElement).value = field.value;
  } else if (field.type === 'select') {
    const select = h('select', attrs) as HTMLSelectElement;
    select.appendChild(h('option', { value: '' }, field.placeholder || 'Choose an option'));
    for (const option of field.options || []) select.appendChild(h('option', { value: option }, option));
    if (typeof field.value === 'string') select.value = field.value;
    control = select;
  } else if (field.type === 'radio') {
    const group = h('div', { class: 'iui-form-radio-group', role: 'radiogroup', 'aria-label': field.label });
    (field.options || []).forEach((option, optionIndex) => {
      const radioId = `${controlId}-${optionIndex}`;
      const input = h('input', { type: 'radio', id: radioId, name: field.id, value: option, required: field.required === true, ...(field.value === option ? { checked: true } : {}) }) as HTMLInputElement;
      group.appendChild(h('label', { class: 'iui-form-choice', for: radioId }, input, h('span', {}, option)));
    });
    control = h('div', { class: 'iui-form-radio-wrap' }, label, group);
  } else if (field.type === 'checkbox') {
    const input = h('input', { type: 'checkbox', id: controlId, name: field.id, value: 'true', ...(field.required ? { required: true } : {}), ...(field.value === true ? { checked: true } : {}) }) as HTMLInputElement;
    control = h('label', { class: 'iui-form-choice iui-form-single-choice', for: controlId }, input,
      h('span', {}, field.label, field.required ? h('span', { class: 'iui-form-required', 'aria-label': 'required' }, ' *') : null));
  } else {
    const inputType = field.type === 'range' ? 'range' : field.type;
    const input = h('input', { ...attrs, type: inputType }) as HTMLInputElement;
    if (field.value !== undefined) input.value = String(field.value);
    if (field.type === 'range') {
      const value = h('output', { class: 'iui-form-range-value', for: controlId }, input.value || '0');
      input.addEventListener('input', () => { value.textContent = input.value; });
      control = h('div', { class: 'iui-form-range-wrap' }, input, value);
    } else control = input;
  }
  if (field.type !== 'radio' && field.type !== 'checkbox') wrapper.appendChild(label);
  wrapper.appendChild(control);
  if (field.help) wrapper.appendChild(h('div', { class: 'iui-form-help' }, field.help));
  return wrapper;
}

export function renderForm(spec: FormSpec, _ctx: RenderContext): HTMLElement {
  const card = h('section', { class: 'iui-card iui-form-card' });
  if (spec.title) card.appendChild(h('div', { class: 'iui-title iui-form-title' }, spec.title));
  if (spec.description) card.appendChild(h('p', { class: 'iui-form-description' }, spec.description));
  const form = h('form', { class: 'iui-form', novalidate: false }) as HTMLFormElement;
  spec.fields.forEach((field, index) => form.appendChild(makeField(field, index)));
  const actions = h('div', { class: 'iui-form-actions' });
  const submit = h('button', { type: 'submit', class: 'iui-btn primary iui-form-submit' }, spec.submitLabel || 'Submit') as HTMLButtonElement;
  const reset = h('button', { type: 'reset', class: 'iui-btn secondary iui-form-reset' }, 'Reset') as HTMLButtonElement;
  actions.append(submit, reset);
  form.appendChild(actions);
  const result = h('section', { class: 'iui-form-result', hidden: true, 'aria-live': 'polite' });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const entries = spec.fields.map((field) => ({
      label: field.label,
      value: field.type === 'checkbox' ? (data.has(field.id) ? 'Yes' : 'No') : (data.get(field.id)?.toString() || '—'),
    }));
    const serialized = entries.map((entry) => `${entry.label}: ${entry.value}`).join('\n');
    result.replaceChildren(
      h('div', { class: 'iui-form-result-heading' }, iconEl('check-circle', 18), h('strong', {}, 'Response ready')),
      h('dl', { class: 'iui-form-result-list' }, ...entries.flatMap((entry) => [h('dt', {}, entry.label), h('dd', {}, entry.value)])),
    );
    const copy = h('button', { type: 'button', class: 'iui-btn secondary iui-form-copy', onClick: () => {
      const clipboard = navigator.clipboard;
      if (clipboard?.writeText) void clipboard.writeText(serialized).then(() => { copy.textContent = 'Copied'; }).catch(() => { copy.textContent = 'Select and copy the answers above'; });
      else copy.textContent = 'Clipboard unavailable';
    } }, iconEl('copy', 14), 'Copy answers');
    result.appendChild(copy);
    result.hidden = false;
    result.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  });
  form.addEventListener('reset', () => { result.hidden = true; });
  card.append(form, result);
  return card;
}
