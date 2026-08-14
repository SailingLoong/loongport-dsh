import type { LoongPortLocaleKey } from './locales.js'
import type { StoreSite } from './store.js'

export type SiteCardProps = {
  site: StoreSite
  t: (key: LoongPortLocaleKey) => string
  onConfigure(siteId: string): Promise<void>
  onClear(siteId: string): Promise<void>
  onManualSetup(siteId: string): void
}

export function SiteCard({ site, t, onConfigure, onClear, onManualSetup }: SiteCardProps): React.JSX.Element {
  const selectedModel = site.models.find((model) => model.default === true) ?? site.models[0]
  const configurable = site.disabled !== true && site.authorization?.kind === 'manual-api-key'

  return <article>
    <header>
      <h3>{site.displayName}</h3>
      <span>{site.disabled === true ? t('disabled') : site.credential.configured ? t('configured') : t('notConfigured')}</span>
    </header>
    {site.sponsorship && <p>{t('sponsorship')}: <a href={site.sponsorship.url} rel="noreferrer" target="_blank">{site.sponsorship.label}</a></p>}
    <p>{t('model')}: {selectedModel?.id ?? '—'}</p>
    <p>{t('availableModels')}: {site.models.map((model) => model.id).join(', ')}</p>
    <p><a href={site.entryUrl} rel="noreferrer" target="_blank">{t('registration')}</a></p>
    {site.inviteCode && <p>{t('invitationCode')}: {site.inviteCode}</p>}
    {site.observation && <section aria-label={t('observation')}>
      <h4>{t('observation')}</h4>
      <p>{t('rank')}: {site.observation.rank ?? '—'} · {t('score')}: {site.observation.score ?? '—'}</p>
      {site.observation.reportUrl && <a href={site.observation.reportUrl} rel="noreferrer" target="_blank">{t('report')}</a>}
    </section>}
    {configurable && <footer>
      <button onClick={() => onManualSetup(site.id)} type="button">{t('manualSetup')}</button>
      {site.credential.configured && <>
        <button onClick={() => void onConfigure(site.id).catch(() => undefined)} type="button">{t('configure')}</button>
        <button onClick={() => void onClear(site.id).catch(() => undefined)} type="button">{t('clearKey')}</button>
      </>}
    </footer>}
  </article>
}
