import { AstUtils, type ValidationAcceptor, type ValidationChecks } from 'langium';
import { isPublisherDiscountType, PublisherDiscountType, PublisherSaleType, PublisherVersionType, PublisherModel, type PublisherAstType, PublisherGameType } from './generated/ast.js';
import type { SharedServices } from './shared-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecksPublisher(services: SharedServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.PublisherValidator;
    const checks: ValidationChecks<PublisherAstType> = {
        PublisherModel: validator.checkGamesChanges,
        PublisherDiscountType: validator.checkDiscountsDoNotOverlap,
        PublisherSaleType: validator.checkDiscountPeriodsWithinSalePeriod,
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

    //TODO - check that publisher cannot create a game with a name that already exists

    checkGamesChanges(model: PublisherModel, accept: ValidationAcceptor): void {
        const publisherName = model.publisher.name

        const db = this.services.db.DatabaseService.getDBSnapshot(publisherName);
        if (db === undefined) {
            accept('warning', 'Could not check cached player library. Try pulling first.', { node: model });
            return;
        }

        const modelGames = model.games.map(g => g.name);
        const dbGames = db.games.filter(g => g.publisher === publisherName).map(g => g.name); 

        const removedGames = dbGames.filter(g => !modelGames.includes(g))
        if (removedGames.length != 0 ){
            accept('error', 'Publisher cannot remove existing game or edit existing name', { node: model });
        }

        const newGames = modelGames.filter(g => !dbGames.includes(g))

        newGames.forEach(name => {
            const newGame = model.games.find(g => g.name == name)
            this.checkNewGame(newGame, accept)
            
        })
    }


    checkNewGame(game: PublisherGameType, accept: ValidationAcceptor): void {
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
        const initVersion = game.versions[0]
        if (initVersion.approved) {
            accept('error', 'Initial version must be unapproved', { node: initVersion, property: "approved"});
        }

        // reviews
        if (game.reviews.length != 0){
            accept('error', 'Unpublished games cannot have reviews', { node: game, property: "reviews"});
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
}
