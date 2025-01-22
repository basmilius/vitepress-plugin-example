import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import MarkdownItContainer from 'markdown-it-container';
const IS_EXAMPLE_RE = /^example=(.+)$/;
const PARSE_CONTAINER_PARAM_RE = /^example\s?(.*?)(?:\s\|\|\s(.*?))?$/;
const SCRIPT_SETUP_RE = /<\s*script[^>]*\bsetup\b[^>]*/;
const SCRIPT_SETUP_TS_RE = /<\s*script[^>]*\blang=['"]ts['"][^>]*/;
const SCRIPT_SETUP_COMMON_RE = /<\s*script\s+(setup|lang='ts'|lang="ts")?\s*(setup|lang='ts'|lang="ts")?\s*>/;
const VALIDATE_CONTAINER_RE = /^example.*$/;
const composeComponentName = (path) => {
    let running = true;
    const componentList = [];
    while (running) {
        const lastIndex = path.lastIndexOf('/');
        if (lastIndex === -1) {
            running = false;
            break;
        }
        componentList.unshift(path.substring(lastIndex + 1));
        path = path.substring(0, lastIndex);
    }
    return componentList
        .filter(i => i !== '' && i !== '.' && i !== '..')
        .join('-')
        .split('.')[0];
};
const convertToRelativePath = (path) => {
    if (path.startsWith('./') || path.startsWith('../') || path.startsWith('/')) {
        return path;
    }
    return `./${path}`;
};
const injectComponent = (env, path, componentName) => {
    const scripts = env.sfcBlocks.scripts;
    const setupIndex = scripts.findIndex(s => SCRIPT_SETUP_RE.test(s.tagOpen) || SCRIPT_SETUP_TS_RE.test(s.tagOpen));
    componentName = normalizeComponentName(componentName);
    if (setupIndex === -1) {
        scripts.push({
            type: 'script',
            tagClose: '</script>',
            tagOpen: `<script lang="ts" setup>`,
            content: `
                <script lang="ts" setup>
                    import ${componentName} from '${path}';
                </script>`,
            contentStripped: `import ${componentName} from '${path}';`
        });
    }
    else {
        const oldScript = scripts[setupIndex];
        if (oldScript.content.includes(path) && oldScript.content.includes(componentName)) {
            scripts[0].content = oldScript.content;
        }
        else {
            const block = '<script lang="ts" setup>';
            scripts[setupIndex].content = scripts[setupIndex].content.replace(SCRIPT_SETUP_COMMON_RE, block);
            scripts[setupIndex].content = scripts[setupIndex].content.replace(block, `<script lang="ts" setup>\nimport ${componentName} from '${path}';\n`);
        }
    }
};
const normalizeComponentName = (componentName) => componentName.replaceAll(/[_|-]+(\w)/g, ($0, $1) => {
    return $1.toUpperCase();
});
const directive = (md) => {
    md.use(MarkdownItContainer, 'example', {
        marker: ':',
        validate(params) {
            const matches = params.trim().match(VALIDATE_CONTAINER_RE);
            return matches && matches.length > 0;
        }
    });
};
const parseContainer = (md) => {
    const defaultHtmlTextRender = md.renderer.rules.text;
    md.renderer.rules.text = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        if (token.type === 'text' && token.content.match(IS_EXAMPLE_RE)) {
            const relativePath = convertToRelativePath(token.content.match(IS_EXAMPLE_RE)[1]);
            const componentName = composeComponentName(relativePath);
            injectComponent(env, relativePath, componentName);
            return `<${componentName}/>`;
        }
        return defaultHtmlTextRender(tokens, idx, options, env, self);
    };
};
const parseTag = (md) => {
    const defaultContainerExampleOpenRender = md.renderer.rules.container_example_open;
    let sourceCodeHighlighted = null;
    // :::example
    md.renderer.rules.container_example_open = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        const relativePath = convertToRelativePath(tokens[idx + 2].content.split('=')[1]);
        const componentPath = resolve(dirname(env.path), relativePath || '.');
        const suffix = componentPath.substring(componentPath.lastIndexOf('.') + 1);
        const sourceCode = readFileSync(componentPath, 'utf-8');
        sourceCodeHighlighted = md.options.highlight(sourceCode, suffix, '');
        const params = tokens[idx].info.trim().match(PARSE_CONTAINER_PARAM_RE);
        const title = params?.[1] || '';
        const description = params?.[2] || '';
        const componentName = composeComponentName(componentPath);
        if (token.nesting === 1) {
            return `
                ${title !== '' ? `<h3 id="${title.toLowerCase()}">${title}</h3>` : ''}
                ${description !== '' ? `<p>${description}</p>` : ''}

                <div class="vp-code-group">
                    <div class="tabs">
                        <input type="radio" name="vite-example-${componentName}" id="vite-example-${componentName}-preview" checked/>
                        <label data-title="Preview" for="vite-example-${componentName}-preview">Preview</label>
                        
                        <input type="radio" name="vite-example-${componentName}" id="vite-example-${componentName}-code"/>
                        <label data-title="Code" for="vite-example-${componentName}-code">Code</label>
                    </div>
                    
                    <div class="blocks">
                        <div class="language-vue vp-adaptive-theme active" style="padding-left: 18px; padding-right: 18px;">
            `;
        }
        return defaultContainerExampleOpenRender(tokens, idx, options, env, self);
    };
    // :::
    const defaultContainerExampleCloseRender = md.renderer.rules.container_example_close;
    md.renderer.rules.container_example_close = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        if (token.nesting === -1) {
            return `
                        </div>
                        <div class="language-vue vp-adaptive-theme">${sourceCodeHighlighted}</div>
                    </div>
                </div>
            `;
        }
        return defaultContainerExampleCloseRender(tokens, idx, options, env, self);
    };
};
export default (md) => {
    directive(md);
    parseTag(md);
    parseContainer(md);
};
