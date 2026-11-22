import { Capacitor } from '@capacitor/core'

/**
 * Identifiants AdMob — tout est centralisé ici.
 *
 * Pour passer des pubs de test aux pubs réelles :
 * 1. Remplace `androidAppId` par l’identifiant d’application AdMob (ca-app-pub-XXXX~YYYY).
 * 2. Remplace `rewardedAdUnitId` par l’identifiant d’unité récompensée (ca-app-pub-XXXX/ZZZZ).
 * 3. Recopie le même identifiant d’application dans
 *    `android/app/src/main/res/values/strings.xml` (`admob_app_id`).
 * 4. Passe `testing` à `false`.
 *
 * Les valeurs ci-dessous sont les identifiants officiels de test Google.
 * @see https://developers.google.com/admob/android/test-ads
 */
export const ADMOB = {
  androidAppId: 'ca-app-pub-3940256099942544~3347511713',
  rewardedAdUnitId: 'ca-app-pub-3940256099942544/5224354917',
  testing: true,
} as const

export function adsAvailable(): boolean {
  return Capacitor.isNativePlatform()
}

let initialized = false
let initPromise: Promise<boolean> | null = null

export async function initAds(): Promise<boolean> {
  if (!adsAvailable()) return false
  if (initialized) return true
  if (initPromise) return initPromise
  initPromise = (async () => {
    const { AdMob } = await import('@capacitor-community/admob')
    await AdMob.initialize({
      initializeForTesting: ADMOB.testing,
    })
    initialized = true
    return true
  })().catch(() => {
    initPromise = null
    return false
  })
  return initPromise
}

export async function showRewardedAd(): Promise<boolean> {
  if (!adsAvailable()) return false
  const ok = await initAds()
  if (!ok) return false
  const { AdMob } = await import('@capacitor-community/admob')
  try {
    await AdMob.prepareRewardVideoAd({
      adId: ADMOB.rewardedAdUnitId,
      isTesting: ADMOB.testing,
      immersiveMode: true,
    })
    const reward = await AdMob.showRewardVideoAd()
    return !!reward
  } catch {
    return false
  }
}
