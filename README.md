# VitePress Examples

This repository contains the source code for the VitePress Examples plugin. This plugin is able to show code examples that include a preview.

## 🚀 Installation

To install the plugin, add the `vitepress-plugin-example` package to your project using `pnpm install vitepress-plugin-example` and add the following to your VitePress config:

```ts
import examplePlugin from 'vitepress-plugin-example';

export default defineConfig({
    // ...
    markdown: {
        config(md) {
            md.use(examplePlugin);
        }
    }
    // ... 
});
```
