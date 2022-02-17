#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const src = __dirname;
const targetDir = 'ilf-editor';
const root = path.join(cwd, targetDir);
const gitignore = `
node_modules
dist
`;

function init() {
    if (!fs.existsSync(root)) {
        fs.mkdirSync(root)
    }

    console.log(`\nКопирую проект в ${root}...`)

    const files = fs.readdirSync(src);
    for (const file of files) {
        copy(path.join(src, file), path.join(root, file));
    }

    fs.writeFileSync(path.join(root, '.gitignore'), gitignore)

    console.log(`\nГотово. Теперь выполните:\n`);
    if (root !== cwd) {
        console.log(`  cd ${path.relative(cwd, root)}`);
    }
    console.log(`  npm install\n`);
}

/**
 *
 * @param {string} src
 * @param {string} dest
 */
function copy(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        copyDir(src, dest);
    } else {
        fs.copyFileSync(src, dest);
    }
}

/**
 * @param {string} srcDir
 * @param {string} destDir
 */
function copyDir(srcDir, destDir) {
    fs.mkdirSync(destDir, { recursive: true })
    for (const file of fs.readdirSync(srcDir)) {
        const srcFile = path.resolve(srcDir, file);
        const destFile = path.resolve(destDir, file);
        copy(srcFile, destFile);
    }
}

try {
    init()
} catch (err) {
    console.error(err);
}
