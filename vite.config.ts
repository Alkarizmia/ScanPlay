import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Injecte le snippet AdSense si absent de index.html + génère dist/ads.txt au build. */
function adsenseSitePlugin(): Plugin {
  return {
    name: 'scanplay-adsense',
    transformIndexHtml(html) {
      if (html.includes('adsbygoogle.js')) return html

      const client = process.env.VITE_ADSENSE_CLIENT?.trim()
      const meta = process.env.VITE_ADSENSE_VERIFY_META?.trim()
      const enabled = process.env.VITE_ADSENSE_ENABLED !== '0'

      let inject = ''
      if (meta && !html.includes('google-adsense-account')) {
        inject += `\n    <meta name="google-adsense-account" content="${meta}">`
      }
      if (client && enabled) {
        inject += `\n    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}" crossorigin="anonymous"></script>`
      }
      if (!inject) return html
      return html.replace('</head>', `${inject}\n  </head>`)
    },
    closeBundle() {
      if (process.env.VITE_ADSENSE_CLIENT?.trim()) return
      writeFileSync(
        resolve(__dirname, 'dist/ads.txt'),
        'google.com, pub-6135402548418867, DIRECT, f08c47fec0942fa0\n',
        'utf8',
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), adsenseSitePlugin()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
})
