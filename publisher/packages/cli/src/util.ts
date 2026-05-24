import type { AstNode, LangiumCoreServices, LangiumDocument } from 'langium';
import chalk from 'chalk';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { URI } from 'langium';
import { DiscountType, GenreType, ReviewType, TransactionType, databaseModel } from '../../language/src/db-model.js';

export async function extractDocument(fileName: string, services: LangiumCoreServices): Promise<LangiumDocument> {
    const extensions = services.LanguageMetaData.fileExtensions;
    if (!extensions.includes(path.extname(fileName))) {
        console.error(chalk.yellow(`Please choose a file with one of these extensions: ${extensions}.`));
        process.exit(1);
    }

    if (!fs.existsSync(fileName)) {
        console.error(chalk.red(`File ${fileName} does not exist.`));
        process.exit(1);
    }

    const document = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(path.resolve(fileName)));
    await services.shared.workspace.DocumentBuilder.build([document], { validation: true });

    const validationErrors = (document.diagnostics ?? []).filter(e => e.severity === 1);
    if (validationErrors.length > 0) {
        console.error(chalk.red('There are validation errors:'));
        for (const validationError of validationErrors) {
            console.error(chalk.red(
                `line ${validationError.range.start.line + 1}: ${validationError.message} [${document.textDocument.getText(validationError.range)}]`
            ));
        }
        process.exit(1);
    }

    return document;
}

export async function extractAstNode<T extends AstNode>(fileName: string, services: LangiumCoreServices): Promise<T> {
    return (await extractDocument(fileName, services)).parseResult?.value as T;
}

interface FilePathData {
    destination: string,
    name: string
}

export function extractDestinationAndName(filePath: string, destination?: string): FilePathData {
    filePath = path.basename(filePath, path.extname(filePath)).replace(/[.-]/g, '');
    return {
        destination: destination ?? path.join(path.dirname(filePath), 'generated'),
        name: path.basename(filePath)
    };
}

export function globalDiscountDSL(discount: DiscountType): string {
    let dsl = ''

    dsl += `discount ${discount.name}\n`;
    dsl += `\tpercentage ${discount.percentage}\n`;
    dsl += `\tstart_date ${discount.start_date}\n`;
    dsl += `\tend_date ${discount.end_date}\n`;
    dsl += `\tgame ${`${discount.game}`}\n\n`

    return dsl
}


export function globalTransactionDSL(transaction: TransactionType): string {
    let dsl = ''

    dsl += `\ttransaction id ${transaction.id}\n`;
    dsl += `\t\t\tsuccessful ${transaction.successful}\n`;
    dsl += `\t\t\tdate ${transaction.date}\n`;
    dsl += `\t\t\tamount ${transaction.amount}\n`;
    dsl += `\t\t\tgame ${transaction.game}`

    return dsl
}

export function globalReviewDSL(review: ReviewType): string {
    let dsl = ''

    dsl += `\treview content "${review.content}"\n`;
    dsl += `\t\t\tauthor "${review.author}"\n`;
    dsl += `\t\t\tis_flagged ${review.is_flagged}`;
    return dsl
}

export function globalGenreDSL(genre: GenreType): string {
    let dsl = ''

    dsl += `genre ${genre.name}\n`;
    dsl += `\tdescription ${`"${genre.description}"`}\n\n`;

    return dsl
}

export function validateDBNotEmpty(db: databaseModel): void {
    if (!db.discounts && !db.games && !db.publishers && !db.administrators && !db.players && !db.genres && !db.requests && !db.sales && !db.reviews && !db.transactions) {
        throw new Error('The database is empty. Please provide a valid database file.');
    }
}

export function formatDateTime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');

    const dd = pad(date.getDate());
    const mm = pad(date.getMonth() + 1);
    const yyyy = date.getFullYear();

    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    const ss = pad(date.getSeconds());

    return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
}
