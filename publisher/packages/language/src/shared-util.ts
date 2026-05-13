import * as langium from 'langium';
import { databaseModel, DiscountType, GameType, GenreType, SaleType, TransactionType } from './db-model.js';
import { PlayerType } from './generated/ast.js';

export class UtilService {
    getDiscountedPrice(game: GameType, sales: SaleType[], standaloneDiscounts: DiscountType[]) {
        const discount = this.getActiveDiscountForGame(game, sales, standaloneDiscounts);
        if (!discount) return game.price;
        return game.price * (1 - discount.percentage / 100);
    }


    getActiveDiscountForGame(game: GameType, sales: SaleType[], standaloneDiscounts: DiscountType[]) {
        const nowTime = new Date().getTime();

        // Check all discounts in sales
        for (const sale of sales) {
            const saleStart = new Date(sale.start_date).getTime();
            const saleEnd = new Date(sale.end_date).getTime();

            if (nowTime < saleStart || nowTime > saleEnd) continue;
            // Join discounts by name to get full discount details
            const discounts = sale.discounts.map(d => standaloneDiscounts.find(ad => ad.name === d));

            const saleDiscount = discounts.find(d => {
                const discountStart = new Date(d.start_date).getTime();
                const discountEnd = new Date(d.end_date).getTime();

                return (
                    d.game === game.name &&
                    nowTime >= discountStart &&
                    nowTime <= discountEnd
                );
            });
            if (saleDiscount) return saleDiscount;
        }

        // Check all standalone discounts
        const standaloneDiscount = standaloneDiscounts.find(d => {
            const discountStart = new Date(d.start_date).getTime();
            const discountEnd = new Date(d.end_date).getTime();

            return (
                d.game === game.name &&
                nowTime >= discountStart &&
                nowTime <= discountEnd
            );
        });
        if (standaloneDiscount) return standaloneDiscount;

        return undefined;
    }


    buildPlayerModelFromDBModel(db: databaseModel, userID: string) {
        //const dbPlayer = db.players.find(p => p.name == userID)
        //const player = {
        //    name: dbPlayer.name,
        //    balance: dbPlayer.balance,
        //    library: {
        //        games: dbPlayer.library.games.map(),
        //    },
        //    transactions: dbPlayer.transactions.map(),
        //};
//
        //const games = db.games.map(g => {
        //    return {
        //        name: g.name,
        //        genres: g.genres.map(),
        //        publisher: g.publisher,
        //        price: g.price,
        //        release_date: g.release_date,
        //        versions: g.versions.map(),
        //    };
        //});
//
        //const publishers = db.publishers.map(p => {
        //    return {
        //        name: p.name,
        //    };
        //});
//
        //const genres = db.genres.map(g => {
        //    return {
        //        name: g.name,
        //        description: g.description,
        //    };
        //});
//
        //const sales = db.sales.map(s => {
        //    return {
        //        name: s.name,
        //        start_date: s.start_date,
        //        end_date: s.end_date,
        //        discounts: s.discounts.map(),
        //    };
        //});
//
        //const discounts = db.discounts.map(d => {
        //    return {
        //        name: d.name,
        //        game: d.game,
        //        percentage: d.percentage,
        //        start_date: d.start_date,
        //        end_date: d.end_date,
        //    };
        //});
    }
}
