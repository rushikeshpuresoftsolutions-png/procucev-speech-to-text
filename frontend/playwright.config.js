import { defineConfig } from '@playwright/test'

const audio = process.env.TEST_MIC_WAV
if (!audio) throw new Error('Set TEST_MIC_WAV to an absolute path to an English speech WAV file.')

export default defineConfig({
  testDir: './e2e',
  timeout: 150_000,
  workers: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:5173',
    permissions: ['microphone'],
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
        '--use-file-for-fake-audio-capture=' + audio],
    },
  },
})
