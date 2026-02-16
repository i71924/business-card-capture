import type { CardFields } from '../types';

interface Props {
  fields: CardFields;
  onChange: (next: CardFields) => void;
  disabled?: boolean;
  showExtended?: boolean;
}

const BASIC_KEYS: Array<{ key: keyof CardFields; label: string }> = [
  { key: 'name', label: '姓名' },
  { key: 'company', label: '公司' },
  { key: 'title', label: '職稱' },
  { key: 'phone', label: '電話' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: '地址' },
  { key: 'website', label: '網站' }
];

function FieldsEditor({ fields, onChange, disabled = false, showExtended = true }: Props) {
  return (
    <div className="fields-grid">
      {BASIC_KEYS.map(({ key, label }) => (
        <label key={key}>
          <span>{label}</span>
          <input
            type="text"
            value={fields[key]}
            onChange={(event) => onChange({ ...fields, [key]: event.target.value })}
            disabled={disabled}
          />
        </label>
      ))}

      {showExtended && (
        <>
          <label>
            <span>tags（逗號分隔）</span>
            <input
              type="text"
              value={fields.tags}
              onChange={(event) => onChange({ ...fields, tags: event.target.value })}
              disabled={disabled}
            />
          </label>
          <label>
            <span>notes</span>
            <textarea
              value={fields.notes}
              onChange={(event) => onChange({ ...fields, notes: event.target.value })}
              disabled={disabled}
              rows={4}
            />
          </label>
        </>
      )}
    </div>
  );
}

export default FieldsEditor;
