import type { AdministratorModel, PlayerModel, PublisherModel } from 'publisher-language';
import { createSharedServices, PublisherLanguageMetaData } from 'publisher-language';
import chalk from 'chalk';
import { Command } from 'commander';
import { extractAstNode } from './util.js';
import { pushToDBPlayer, pushToDBPublisher, pushToDBAdministrator, generateFromDB } from './generator.js';
import { NodeFileSystem } from 'langium/node';
import * as url from 'node:url';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const packagePath = path.resolve(__dirname, '..', 'package.json');
const packageContent = await fs.readFile(packagePath, 'utf-8');


export const pushAction = async (fileName: string, userID: string, opts: PushOptions): Promise<void> => {
    const services = createSharedServices(NodeFileSystem);
    let model: AdministratorModel | PublisherModel | PlayerModel;
    if (fileName.endsWith(".player")) {
        model = await extractAstNode<PlayerModel>(fileName, services.Player);
        const generatedFilePath = pushToDBPlayer(model, opts.database);
        generateFromDB('player', userID, generatedFilePath, fileName);
        console.log(chalk.green(`Player model pushed to database successfully: ${generatedFilePath}`));
    } else if (fileName.endsWith(".publisher")) {
        model = await extractAstNode<PublisherModel>(fileName, services.Publisher);
        const generatedFilePath = pushToDBPublisher(model, opts.database);
        generateFromDB('publisher', userID, generatedFilePath, fileName);
        console.log(chalk.green(`Publisher model pushed to database successfully: ${generatedFilePath}`));
    } else if (fileName.endsWith(".administrator")) {
        model = await extractAstNode<AdministratorModel>(fileName, services.Administrator);
        const generatedFilePath = pushToDBAdministrator(model, opts.database);
        generateFromDB('administrator', userID, generatedFilePath, fileName);
        console.log(chalk.green(`Administrator model pushed to database successfully: ${generatedFilePath}`));
    }
};

export const pullAction = async (fileType: string, userID: string, opts: PullOptions): Promise<void> => {
    const generatedFilePath = generateFromDB(fileType, userID, opts.database);
    console.log(chalk.green(`Pulled from database successfully: ${generatedFilePath}`));
};

export type PullOptions = {
    database?: string;
}

export type PushOptions = {
    database?: string;
}

export default function (): void {
    const program = new Command();

    program.version(JSON.parse(packageContent).version);

    const fileExtensions = PublisherLanguageMetaData.fileExtensions.join(', ');
    program
        .command('push')
        .argument('<file>', `source file to push (possible file extensions: ${fileExtensions})`)
        .argument('<userID>', `id of the user to push the file for`)
        .option('-d, --database <dir>', 'location of the database file')
        .description('Push language file to database and generate a snapshot for the user')
        .action(pushAction);

    program
        .command('pull')
        .argument('<fileType>', `type of file to generate (possible types: publisher, player, administrator)`)
        .argument('<userID>', `id of the user to generate the file for`)
        .option('-d, --database <dir>', 'location of the database file')
        .description('Pull language file from database and generate it for the user')
        .action(pullAction);

    program.parse(process.argv);
}
