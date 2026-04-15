import type { AdministratorModel, PlayerModel, PublisherModel } from 'publisher-language';
import { createSharedServices, PublisherLanguageMetaData } from 'publisher-language';
import chalk from 'chalk';
import { Command } from 'commander';
import { extractAstNode } from './util.js';
import { generateJavaScript } from './generator.js';
import { NodeFileSystem } from 'langium/node';
import * as url from 'node:url';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const packagePath = path.resolve(__dirname, '..', 'package.json');
const packageContent = await fs.readFile(packagePath, 'utf-8');

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = createSharedServices(NodeFileSystem);
    let model;
    if (fileName.endsWith(".publisher")) {
        model = await extractAstNode<PublisherModel>(fileName, services.Publisher);
    } else if (fileName.endsWith(".player")) {
        model = await extractAstNode<PlayerModel>(fileName, services.Player);
    } else if (fileName.endsWith(".administrator")) {
        model = await extractAstNode<AdministratorModel>(fileName, services.Administrator);
    }
    const generatedFilePath = generateJavaScript(model, fileName, opts.destination);
    console.log(chalk.green(`JavaScript code generated successfully: ${generatedFilePath}`));
};

export type GenerateOptions = {
    destination?: string;
}

export default function(): void {
    const program = new Command();

    program.version(JSON.parse(packageContent).version);

    const fileExtensions = PublisherLanguageMetaData.fileExtensions.join(', ');
    program
        .command('generate')
        .argument('<file>', `source file (possible file extensions: ${fileExtensions})`)
        .option('-d, --destination <dir>', 'destination directory of generating')
        .description('generates JavaScript code that prints "Hello, {name}!" for each greeting in a source file')
        .action(generateAction);

    program.parse(process.argv);
}
