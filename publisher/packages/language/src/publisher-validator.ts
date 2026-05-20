import { AstUtils, type ValidationAcceptor, type ValidationChecks } from 'langium';
import { isPublisherDiscountType, PublisherDiscountType, PublisherSaleType, PublisherModel, type PublisherAstType, PublisherGameType, PublisherType } from './generated/ast.js';
import type { SharedServices } from './shared-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecksPublisher(services: SharedServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.PublisherValidator;
    const checks: ValidationChecks<PublisherAstType> = {
        PublisherModel: [
            validator.checkGamesChanges,
            validator.checkDiscountsChanges,
            validator.checkNoUnauthorizedChanges,
        ],
        PublisherDiscountType:[
            validator.checkDiscountsDoNotOverlap,
            validator.checkDiscountPercentage,
        ],
        PublisherSaleType: validator.checkDiscountPeriodsWithinSalePeriod,
        PublisherType: [
            validator.checkPublisherBalancePositive,
            validator.checkPublisherBalanceCannotDecrease,
        ],
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 * 
 * Publisher allowed actions:
 * - Add new games, where first version is unapproved
 * - Add new versions for published games
 * - Add genre 
 * - Add discounts to published games 
 */
export class PublisherValidator {
    constructor(private services: SharedServices) { }

    checkGenresChanges(model: PublisherModel, accept: ValidationAcceptor): void {
        const publisherName = model.publisher.name

        const db = this.services.db.DatabaseService.getDBSnapshot("publisher", publisherName);
        if (db === undefined) {
            accept('warning', 'Could not check cached publisher\'s games. Try pulling first.', { node: model });
            return;
        }

        // existing genres cannot be removed or edited
        const removedGenres = db.genres.filter(dbGen => 
            !model.genres.some(mGen => 
                dbGen.description   == mGen.description &&
                dbGen.name          == mGen.name
            )
        )

        if (removedGenres.length != 0){
            accept('error', 'Publishers cannot remove or change existing genres', { node: model });
        }

        // new genres must have unique name
        const newGenres = model.genres.filter(dbGen => 
            !db.genres.some(mGen => 
                dbGen.description   == mGen.description &&
                dbGen.name          == mGen.name
            )
        )

        newGenres.forEach(g => {
            if (db.genres.some(dbGen => dbGen.name == g.name)) {
                accept('error', 'Genre name must be unique', { node: g, property: "name"});
            }
        })
    }
    
    checkDiscountsChanges(model: PublisherModel, accept: ValidationAcceptor): void {
        const publisherName = model.publisher.name

        const db = this.services.db.DatabaseService.getDBSnapshot("publisher", publisherName);
        if (db === undefined) {
            accept('warning', 'Could not check cached publisher\'s games. Try pulling first.', { node: model });
            return;
        }

        const dbPublisherGames = db.games.filter(g => g.publisher == publisherName).map(g => g.name)

        const modelDiscounts = model.discounts
        const dbDiscounts = db.discounts

        // no changes allowed on discounts for other publishers games
        const removedDiscounts = dbDiscounts.filter(dbDis => 
            !modelDiscounts.some(mDis =>
                 mDis.game.ref.name == dbDis.game &&
                 mDis.name          == dbDis.name &&
                 mDis.percentage    == dbDis.percentage &&
                 mDis.start_date    == dbDis.start_date &&
                 mDis.end_date      == dbDis.end_date
            ))
        removedDiscounts.forEach(d => {
            if (!dbPublisherGames.includes(d.game)){
                accept('error', 'Publishers cannot remove or change discount for other games than their own', { node: model });
            }  
        })

        // check new discounts
        const newDiscounts = modelDiscounts.filter(mDis =>
            !dbDiscounts.some(dbDis =>
                mDis.game.ref.name == dbDis.game &&
                 mDis.name          == dbDis.name &&
                 mDis.percentage    == dbDis.percentage &&
                 mDis.start_date    == dbDis.start_date &&
                 mDis.end_date      == dbDis.end_date
            )
        )

        newDiscounts.forEach(d => {
            // should be for publisher's game
            if (!dbPublisherGames.includes(d.game.ref.name)){
                accept('error', 'Publishers can only create discounts for their own games', { node: d, property: "game" });
            }
        })
    }

    checkGamesChanges(model: PublisherModel, accept: ValidationAcceptor): void {
        const publisherName = model.publisher.name

        const db = this.services.db.DatabaseService.getDBSnapshot("publisher", publisherName);
        if (db === undefined) {
            accept('warning', 'Could not check cached publisher\'s games. Try pulling first.', { node: model });
            return;
        }

        const dbPublisherGames = db.games.filter(g => g.publisher === publisherName).map(g => g.name); 
        const modelGames = model.games.map(g => g.name);
        const removedGames = dbPublisherGames.filter(g => !modelGames.includes(g))
        if (removedGames.length > 0 ){
            accept('error', 'Publisher cannot remove existing game or edit existing name', { node: model, property: "games"});
        }

        const newGames = modelGames.filter(g => !dbPublisherGames.includes(g))
        newGames.forEach(name => {
            const newGame = model.games.find(g => g.name == name);
            this.checkNewGame(newGame, dbPublisherGames, accept);
        })

        const existingGames = model.games.filter(g => dbPublisherGames.includes(g.name));
        for (const game of existingGames) {
            const dbGame = db.games.find(g => g.name === game.name && g.publisher === publisherName);
            if (!dbGame) continue;

            // prevent deletion of existing versions
            const dbVersionIds = dbGame.versions.map(v => v.version_id);
            const modelVersionIds = game.versions.map(v => v.name);
            const removedVersionIds = dbVersionIds.filter((id: string) => !modelVersionIds.includes(id));
            if (removedVersionIds.length > 0) {
                accept('error', 'Publisher cannot remove existing game versions', { node: game, property: 'versions' });
            }

            // only one current version allowed per game
            const currentCount = game.versions.filter(v => v.approved && v.is_current).length;
            if (currentCount > 1) {
                accept('error', 'There can only be one approved current version for each game', { node: game, property: 'versions' });
            }

            // disallow publishers approving existing versions (only admins may approve)
            for (const modelVersion of game.versions) {
                const matchingDbVersion = dbGame.versions.find(dbVersion => dbVersion.version_id === modelVersion.name);
                if (matchingDbVersion && !matchingDbVersion.approved && modelVersion.approved) {
                    accept('error', 'Publishers cannot mark versions as approved', { node: modelVersion, property: 'approved' });
                }
            }
        }
    }


    checkNewGame(game: PublisherGameType, dbGames: String[], accept: ValidationAcceptor): void {
        // name should be unique
        if (dbGames.includes(game.name)){
            accept('error', 'Another game with this name already exists', { node: game, property: "name"});
        }
        
        // price
        if (game.price < 0){
            accept('error', 'Game price cannot be negative', { node: game, property: "price"});
        }

        // release date
        const releaseTime = new Date(game.release_date).getTime()
        const nowTime = new Date().getTime()
        if (releaseTime > nowTime){
            accept('error', 'Game release date cannot be in the future', { node: game, property: "release_date"});
        }

        // versions
        if (game.versions.length != 1) {
            accept('error', 'Unpublished games must only have an initial version', { node: game, property: "versions"});
        }
        const initVersion = game.versions[0];
        if (!initVersion.is_current) {
            accept('error', 'Initial version must be the current version', { node: initVersion, property: 'is_current' });
        }
        if (initVersion.approved) {
            accept('error', 'Initial version must be unapproved', { node: initVersion, property: "approved"});
        }

        // reviews
        if (game.reviews.length != 0){
            accept('error', 'Unpublished games cannot have reviews', { node: game, property: "reviews"});
        }

        // purchased count must be 0
        if (game.purchased_count != 0){
            accept('error', 'Unpublished games cannot have any purchases', { node: game, property: "purchased_count"});
        }
    }


    checkDiscountsDoNotOverlap(discount: PublisherDiscountType, accept: ValidationAcceptor): void {
        const container = discount.$container;

        const allDiscounts = AstUtils.streamAllContents(container)
            .filter(isPublisherDiscountType)
            .filter(d => d.game == discount.game)
            .toArray();

        for (const otherDiscount of allDiscounts) {
            if (otherDiscount !== discount) {
                const otherStart = new Date(otherDiscount.start_date);
                const otherEnd = new Date(otherDiscount.end_date);
                const discountStart = new Date(discount.start_date);
                const discountEnd = new Date(discount.end_date);
                
                if (discountStart < otherEnd && discountEnd > otherStart) {
                    accept('error', 'Discount periods should not overlap.', { node: discount });
                    break;
                }
            }
        }
    }

    checkDiscountPercentage(discount: PublisherDiscountType, accept: ValidationAcceptor): void {
        if (0 >= discount.percentage || discount.percentage >= 100){
            accept('error', 'Discounts must be above 0 and below 100', { node: discount, property: "percentage" });
        }
    }


    checkDiscountPeriodsWithinSalePeriod(sale: PublisherSaleType, accept: ValidationAcceptor): void {
        const saleStart = new Date(sale.start_date);
        const saleEnd = new Date(sale.end_date);
        
        for (const discount of sale.discounts) {      
            const discountStart = new Date(discount.ref.start_date);
            const discountEnd = new Date(discount.ref.end_date);

            if (discountStart < saleStart || discountEnd > saleEnd) {
                accept('error', 'Discount periods in a sale event must be within the sale\'s period.', { node: discount.ref });
                break;
            }
        }
    }


    checkPublisherBalancePositive(publisher: PublisherType, accept: ValidationAcceptor): void {
        if (publisher.balance < 0) {
            accept('error', 'Balance cannot be negative', { node: publisher, property: 'balance' });
        }
    }


    checkPublisherBalanceCannotDecrease(publisher: PublisherType, accept: ValidationAcceptor): void {
        const db = this.services.db.DatabaseService.getDBSnapshot("publisher", publisher.name);
        if (db === undefined) {
            accept('warning', 'Could not check cached publisher balance. Try pulling first.', { node: publisher });
            return;
        }

        const current_balance = db?.publishers.find(p => p.name == publisher.name)?.balance;
        if (publisher.balance < current_balance) {
            accept('error', 'Balance cannot decrease', { node: publisher, property: 'balance' });
        }
    }


    checkNoUnauthorizedChanges(model: PublisherModel, accept: ValidationAcceptor): void {
        const db = this.services.db.DatabaseService.getDBSnapshot("publisher", model.publisher.name);
        if (db === undefined) {
            accept('warning', 'Could not check cached data. Try pulling first.', { node: model });
            return;
        }

        const dbModel = this.services.util.UtilService.buildPublisherModelFromDBModel(db, model.publisher.name);
        const allowed = [
            'publisher.balance',
            'games[*].name',
            'games[*].genres',
            'games[*].price',
            'games[*].release_date',
            'games[*].versions',
            'games[*].purchased_count',
            'genres[*]',
            'discounts[*]',
        ];
        this.services.util.UtilService.assertNoUnauthorizedChanges(model, dbModel, allowed, accept, model);
    }
}
