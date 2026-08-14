import { useState, type FormEvent } from 'react'

import type { LoongPortLocaleKey } from './locales.js'

export type ManualKeyDialogProps = {
  siteName: string
  t: (key: LoongPortLocaleKey) => string
  onSave(value: string): Promise<void>
  onCancel(): void
}

export function ManualKeyDialog({ siteName, t, onSave, onCancel }: ManualKeyDialogProps): React.JSX.Element {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)
    setFailed(false)
    try {
      await onSave(value)
      setValue('')
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  function cancel(): void {
    setValue('')
    setFailed(false)
    onCancel()
  }

  return <div role="dialog" aria-modal="true" aria-label={t('manualTitle')}>
    <h3>{t('manualTitle')}: {siteName}</h3>
    <p>{t('manualDescription')}</p>
    <form onSubmit={submit}>
      <label>
        {t('apiKey')}
        <input
          autoComplete="off"
          disabled={saving}
          onChange={(event) => setValue(event.target.value)}
          required
          type="password"
          value={value}
        />
      </label>
      {failed && <p role="alert">{t('saveFailed')}</p>}
      <button disabled={saving || value.trim() === ''} type="submit">{t('save')}</button>
      <button disabled={saving} onClick={cancel} type="button">{t('cancel')}</button>
    </form>
  </div>
}
