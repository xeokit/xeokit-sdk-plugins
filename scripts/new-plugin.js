import {execSync} from "node:child_process";
import {appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";

const name = process.argv[2];
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name ?? "")) {
    console.error("Usage: npm run new -- <name>   (kebab-case, e.g. section-planes)");
    process.exit(1);
}
const dir = `packages/${name}`;
if (existsSync(dir)) {
    console.error(`${dir} already exists`);
    process.exit(1);
}

const pkgName = `@xeokit/sdk-plugins-${name}`;
const id = name.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join("");
const className = `${id}Plugin`;
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");

mkdirSync(`${dir}/src`, {recursive: true});
copyFileSync("packages/walk-mode/tsconfig.json", `${dir}/tsconfig.json`);
writeJson(`${dir}/package.json`, {
    ...readJson("packages/walk-mode/package.json"),
    name: pkgName,
    version: "0.1.0",
    description: `xeokit-sdk plugin ${className}`
});
writeFileSync(`${dir}/README.md`, `# ${className}\n\n\`\`\`javascript\nimport {${className}} from "@xeokit/sdk-plugins";\n\nconst plugin = new ${className}(viewer);\n\`\`\`\n`);
writeFileSync(`${dir}/src/index.ts`, `export {${className}, type ${className}Config} from "./${className}.js";\n`);
writeFileSync(`${dir}/src/${className}.ts`, `import {Plugin, type Viewer} from "@xeokit/xeokit-sdk";

/**
 * Configuration for {@link ${className}}.
 */
export interface ${className}Config {
    /** Optional ID for this plugin, unique among the plugins of the Viewer. Default "${id}". */
    id?: string;
}

/**
 * {@link Viewer} plugin.
 *
 * @document ../README.md
 */
export class ${className} extends Plugin {
    constructor(viewer: Viewer, cfg: ${className}Config = {}) {
        super("${id}", viewer, cfg);
    }

    override destroy(): void {
        super.destroy();
    }
}
`);

const root = readJson("package.json");
root.dependencies = {...root.dependencies, [pkgName]: "*"};
root.bundleDependencies = [...root.bundleDependencies, pkgName].sort();
writeJson("package.json", root);
appendFileSync("registry.ts", `export * from "${pkgName}";\n`);

execSync("npm install --no-audit --no-fund", {stdio: "inherit"});
console.log(`Created ${dir}; add ${className} to the plugin table in README.md`);
