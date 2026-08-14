import { useEffect, useSyncExternalStore, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

import { ManualKeyDialog } from './ManualKeyDialog.js'
import type { LoongPortLocaleKey } from './locales.js'
import { SiteCard } from './SiteCard.js'
import type { LoongPortStore } from './store.js'

export type LoongPortSectionInjected = { store: LoongPortStore }

export type LoongPortSectionProps = PropsRuntime<'settings.section'>
  & PropsLocale<'settings.loongport'>
  & InjectFace<LoongPortSectionInjected>

export function LoongPortSection({ store, t }: LoongPortSectionProps): React.JSX.Element {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [manualSiteId, setManualSiteId] = useState<string | null>(null)

  useEffect(() => {
    if (!store.hasLoaded()) void store.load()
  }, [store])

  const manualSite = snapshot.sites.find((site) => site.id === manualSiteId)
  const translate = t as (key: LoongPortLocaleKey) => string

  return <section aria-label={translate('title')}>
    <h2>{translate('title')}</h2>
    {snapshot.phase === 'loading' && <p>{translate('loading')}</p>}
    {snapshot.phase === 'directory-unavailable' && <div role="status">
      <p>{translate('directoryUnavailable')}</p>
      <button onClick={() => void store.refresh()} type="button">{translate('refresh')}</button>
    </div>}
    {snapshot.phase === 'ready' && <div>
      {snapshot.sites.map((site) => <SiteCard
        key={site.id}
        onClear={(siteId) => store.clearApiKey({ siteId })}
        onConfigure={(siteId) => store.configureSite({ siteId })}
        onManualSetup={setManualSiteId}
        site={site}
        t={translate}
      />)}
    </div>}
    {manualSite && <ManualKeyDialog
      onCancel={() => setManualSiteId(null)}
      onSave={async (value) => {
        await store.saveApiKey({ siteId: manualSite.id, value })
        setManualSiteId(null)
      }}
      siteName={manualSite.displayName}
      t={translate}
    />}
  </section>
}
