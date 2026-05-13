import chalk from 'chalk';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { URI } from 'langium';
export async function extractDocument(fileName, services) {
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
            console.error(chalk.red(`line ${validationError.range.start.line + 1}: ${validationError.message} [${document.textDocument.getText(validationError.range)}]`));
        }
        process.exit(1);
    }
    return document;
}
export async function extractAstNode(fileName, services) {
    return (await extractDocument(fileName, services)).parseResult?.value;
}
export function extractDestinationAndName(filePath, destination) {
    filePath = path.basename(filePath, path.extname(filePath)).replace(/[.-]/g, '');
    return {
        destination: destination ?? path.join(path.dirname(filePath), 'generated'),
        name: path.basename(filePath)
    };
}
export function globalDiscountDSL(discount) {
    let dsl = '';
    dsl += `discount ${discount.name}\n`;
    dsl += `\tpercentage ${discount.percentage}\n`;
    dsl += `\tstart_date ${discount.start_date}\n`;
    dsl += `\tend_date ${discount.end_date}\n`;
    dsl += `\tgame ${`${discount.game}`}\n\n`;
    return dsl;
}
export function globalTransactionDSL(transaction) {
    let dsl = '';
    dsl += `\ttransaction id ${transaction.id}\n`;
    dsl += `\t\tsuccessful ${transaction.successful}\n`;
    dsl += `\t\tdate ${transaction.date}\n`;
    dsl += `\t\tamount ${transaction.amount}\n`;
    dsl += `\t\tgame ${transaction.game}`;
    return dsl;
}
export function globalGenreDSL(genre) {
    let dsl = '';
    dsl += `genre ${genre.name}\n`;
    dsl += `\tdescription ${`"${genre.description}"`}\n\n`;
    return dsl;
}
export function getDiscountedPrice(game, sales, standaloneDiscounts) {
    const discount = getActiveDiscountForGame(game, sales, standaloneDiscounts);
    if (!discount)
        return game.price;
    return game.price * (1 - discount.percentage / 100);
}
function getActiveDiscountForGame(game, sales, standaloneDiscounts) {
    const nowTime = new Date().getTime();
    // Check all discounts in sales
    for (const sale of sales) {
        const saleStart = new Date(sale.start_date).getTime();
        const saleEnd = new Date(sale.end_date).getTime();
        if (nowTime < saleStart || nowTime > saleEnd)
            continue;
        const saleDiscount = sale.discounts.find(d => {
            const discountStart = new Date(d.start_date).getTime();
            const discountEnd = new Date(d.end_date).getTime();
            return (d.game === game.name &&
                nowTime >= discountStart &&
                nowTime <= discountEnd);
        });
        if (saleDiscount)
            return saleDiscount;
    }
    // Check all standalone discounts
    const standaloneDiscount = standaloneDiscounts.find(d => {
        const discountStart = new Date(d.start_date).getTime();
        const discountEnd = new Date(d.end_date).getTime();
        return (d.game === game.name &&
            nowTime >= discountStart &&
            nowTime <= discountEnd);
    });
    if (standaloneDiscount)
        return standaloneDiscount;
    return undefined;
}
//# sourceMappingURL=util.js.map