import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@mercuryworkshop/scramjet/dist/*',
          dest: 'scramjet'
        },
        {
          src: 'node_modules/@mercuryworkshop/bare-mux/dist/*',
          dest: 'baremux'
        },
        {
          src: 'node_modules/@mercuryworkshop/epoxy-transport/dist/*',
          dest: 'epoxy'
        }
      ]
    })
  ],
})
