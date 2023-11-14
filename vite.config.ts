/* eslint-disable quote-props */
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  build: { sourcemap: true },
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      sass: {
        additionalData: `
          @import '$lib/sass/variables'
          @import '$lib/sass/mixins'
        `
      }
    }
  }
})
