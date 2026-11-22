import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'africa.freeshop.nokouerush',
  appName: 'Nokoué Rush',
  webDir: 'dist',
  android: {
    backgroundColor: '#083038',
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
}

export default config
