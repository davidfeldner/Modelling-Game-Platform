import { Reference, type ValidationAcceptor } from 'langium';
import { databaseModel, DiscountType, GameType, SaleType } from './db-model.js';

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


    buildPublisherModelFromDBModel(db: databaseModel, userID: string) {
        const dbPublisher = db.publishers.find(p => p.name == userID);
        if (!dbPublisher) return undefined;

        const games = db.games
            .filter(g => g.publisher === userID)
            .map(g => ({
                name: g.name,
                genres: g.genres.map(genre => ({ name: genre })),
                publisher: { name: g.publisher },
                price: g.price,
                release_date: g.release_date,
                versions: g.versions.map(v => ({ name: v.version_id, game_files: v.game_files, is_current: v.is_current, approved: v.approved })),
                reviews: (g.reviews || []).map(r => ({ content: r.content, is_flagged: r.is_flagged, author: { name: r.author.name } }))
            }));
        
        const genres = db.genres.map(g => ({ name: g.name, description: g.description }));

        const sales = db.sales.map(s => ({ name: s.name, start_date: s.start_date, end_date: s.end_date, discounts: s.discounts.map(discount => ({ name: discount }))}));

        const discounts = db.discounts.map(d => ({ name: d.name, game: d.game, percentage: d.percentage, start_date: d.start_date, end_date: d.end_date }));

        const publisher = {
            name: dbPublisher.name,
            balance: dbPublisher.balance
        };

        return {
            publisher,
            games,
            genres,
            sales,
            discounts
        };
    }


    buildAdministratorModelFromDBModel(db: databaseModel, userID: string) {
        const dbAdmin = db.administrators.find(a => a.name == userID);
        if (!dbAdmin) return undefined;

        const games = db.games.map(g => ({
            name: g.name,
            genres: g.genres.map(genre => ({ name: genre })),
            publisher: { name: g.publisher },
            price: g.price,
            release_date: g.release_date,
            versions: g.versions.map(v => ({ name: v.version_id, game_files: v.game_files, is_current: v.is_current, approved: v.approved })),
            reviews: (g.reviews || []).map(r => ({ content: r.content, is_flagged: r.is_flagged, author: { name: r.author.name } }))
        }));

        const requests = db.requests.map(r => ({ game: { name: r.game }, game_version: { name: r.game_version }, status: r.status }));

        const sales = db.sales.map(s => ({ name: s.name, start_date: s.start_date, end_date: s.end_date, discounts: s.discounts.map(discount => ({ name: discount })) }));

        const discounts = db.discounts.map(d => ({ name: d.name, percentage: d.percentage, start_date: d.start_date, end_date: d.end_date, game: { name: d.game } }));

        const genres = db.genres.map(g => ({ name: g.name, description: g.description }));

        const publishers = db.publishers.map(p => ({ name: p.name, balance: p.balance }));

        const players = db.players.map(p => ({ name: p.name, balance: p.balance }));
        
        const administrator = {
            name: dbAdmin.name
        };

        return {
            administrator,
            games,
            requests,
            sales,
            discounts,
            genres,
            publishers,
            players
        };
    }

    
    assertNoUnauthorizedChanges(modelNode: any, dbModelNode: any, allowed: string[], accept: ValidationAcceptor, nodeForReport: any, path = '', reportProperty?: string): void {        
        if (this.matches(path, allowed)) {
            return;
        }

        if (this.isLeaf(modelNode) || this.isLeaf(dbModelNode)) {
            // Determine a suitable AST node for reporting: prefer the model's AST node,
            // otherwise fall back to the provided parent
            const reportNode = this.isAstNode(modelNode) ? modelNode : nodeForReport;
            const reportOptions = this.isAstNode(modelNode) || reportProperty === undefined
                ? { node: reportNode }
                : { node: reportNode, property: reportProperty };

            // Addition: model has value, DB does not
            if (modelNode !== undefined && dbModelNode === undefined) {
                accept('error', 'Adding item not allowed here', reportOptions);
                return;
            }
            // Deletion: DB has value, model removed
            if (modelNode === undefined && dbModelNode !== undefined) {
                accept('error', 'Removing item not allowed here', reportOptions);
                return;
            }

            const a = this.getNormalizedNodeValue(modelNode);
            const b = this.getNormalizedNodeValue(dbModelNode);
            if (a !== b) {
                accept('error', `Editing item not allowed here`, reportOptions);
            }
            return;
        }

        if (Array.isArray(modelNode) || Array.isArray(dbModelNode)) {
            const modelArray = Array.isArray(modelNode) ? modelNode : [];
            const dbArray = Array.isArray(dbModelNode) ? dbModelNode : [];
            const maxLength = Math.max(modelArray.length, dbArray.length);
            for (let i = 0; i < maxLength; i++) {
                this.assertNoUnauthorizedChanges(
                    modelArray[i],
                    dbArray[i],
                    allowed,
                    accept,
                    this.isAstNode(modelArray[i]) ? modelArray[i] : nodeForReport,
                    `${path}[${i}]`,
                    reportProperty
                );
            }
            return;
        }

        // Use DB keys as the basis for comparison. First check keys present in DB (detect deletions/edits),
        // then detect any extra keys in the model (additions).
        const dbKeys = Object.keys(dbModelNode || {});
        const modelKeys = Object.keys(modelNode || {}).filter(k => !k.startsWith('$'));
        for (const k of dbKeys) {
            const childModelNode = modelNode && k in modelNode ? modelNode[k] : undefined;
            this.assertNoUnauthorizedChanges(
                childModelNode,
                dbModelNode[k],
                allowed,
                accept,
                this.isAstNode(childModelNode) ? childModelNode : nodeForReport,
                path ? `${path}.${k}` : k,
                k
            );
        }
        for (const k of modelKeys) {
            if (dbKeys.includes(k)) continue;
            this.assertNoUnauthorizedChanges(
                modelNode[k],
                undefined,
                allowed,
                accept,
                this.isAstNode(modelNode[k]) ? modelNode[k] : nodeForReport,
                path ? `${path}.${k}` : k,
                k
            );
        }
    }


    matches(path: string, allowed: string[]) {
        return allowed.some(p => p === path || new RegExp('^' + p.replace(/\./g, '\\.').replace(/\[\*\]/g, '\\[[0-9]+\\]')).test(path));
    }


    isLangiumRef(x: any): x is Reference<any> {
        return x && typeof x === 'object' && 'ref' in x;
    }


    isAstNode(x: any) {
        return x && typeof x === 'object' && ('$type' in x);
    }


    isLeaf(x: any) {
        return x == null || typeof x !== 'object' || this.isLangiumRef(x);
    }


    getNormalizedNodeValue(x: any) {
        if (this.isLangiumRef(x)) return this.getNormalizedNodeValue(x.ref);
        if (x == null) return x;
        if (typeof x !== 'object') return x;
        // Prefer common identity fields for comparison
        if ('name' in x && typeof x.name === 'string') return x.name;
        if ('id' in x && typeof x.id === 'string') return x.id;
        return x;
    }
}
