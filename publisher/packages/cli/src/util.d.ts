import type { AstNode, LangiumCoreServices, LangiumDocument } from 'langium';
import { DiscountType, GameType, GenreType, SaleType, TransactionType } from '../../language/src/db-model.js';
export declare function extractDocument(fileName: string, services: LangiumCoreServices): Promise<LangiumDocument>;
export declare function extractAstNode<T extends AstNode>(fileName: string, services: LangiumCoreServices): Promise<T>;
interface FilePathData {
    destination: string;
    name: string;
}
export declare function extractDestinationAndName(filePath: string, destination?: string): FilePathData;
export declare function globalDiscountDSL(discount: DiscountType): string;
export declare function globalTransactionDSL(transaction: TransactionType): string;
export declare function globalGenreDSL(genre: GenreType): string;
export declare function getDiscountedPrice(game: GameType, sales: SaleType[], standaloneDiscounts: DiscountType[]): number;
export {};
