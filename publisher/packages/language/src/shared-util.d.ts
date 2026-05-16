import { databaseModel, DiscountType, GameType, GenreType, SaleType } from './db-model.js';

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
        const dbPlayer = db.players.find(p => p.name == userID);
        if (!dbPlayer) return undefined;

        const games = db.games.map(g => ({
            name: g.name,
            genres: g.genres.map(genre => ({ name: genre })),
            publisher: { name: g.publisher },
            price: g.price,
            release_date: g.release_date,
            versions: g.versions.map(v => ({ name: v.version_id, game_files: v.game_files })),
            reviews: (g.reviews || []).map(r => ({ content: r.content, is_flagged: r.is_flagged, author: { name: r.author.name } }))
        }));

        const publishers = db.publishers.map(p => ({ name: p.name }));

        const genres = db.genres.map(g => ({ name: g.name, description: g.description }));

        const sales = db.sales.map(s => ({ name: s.name, start_date: s.start_date, end_date: s.end_date, discounts: s.discounts.map(discount => ({ name: discount })) }));

        const discounts = db.discounts.map(d => ({ name: d.name, game: d.game, percentage: d.percentage, start_date: d.start_date, end_date: d.end_date }));

        const player = {
            name: dbPlayer.name,
            balance: dbPlayer.balance,
            library: {
                games: (dbPlayer.library?.games || []).map(g => ({ name: g }))
            },
            transactions: (dbPlayer.transactions || []).map(t => ({ id: t.id, successful: t.successful, date: t.date, amount: t.amount, game: { name: t.game } }))
        };

        return {
            player,
            games,
            publishers,
            genres,
            sales,
            discounts
        };
    }

    buildPlayerGame(dbGame: GameType) {
        return {
            name: dbGame.name,
            release_date: dbGame.release_date,
            price: dbGame.price,
            versions: dbGame.versions,
            publisher: dbGame.publisher,
            genres: dbGame.genres,
        };
    }

    buildPlayerGenre(dbGenre: GenreType) {
        return {
            name: dbGenre.name,
            description: dbGenre.description,
        };
    }
}
