import { AstUtils, type ValidationAcceptor, type ValidationChecks } from 'langium';
import { PlayerModel, PlayerGameType, PlayerType, PlayerReviewType, type PublisherAstType } from './generated/ast.js';
import { type SharedServices } from './shared-module.js';
import { a } from 'vitest/dist/chunks/suite.d.FvehnV49.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecksPlayer(services: SharedServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.PlayerValidator;
    const checks: ValidationChecks<PublisherAstType> = {
        PlayerModel: [validator.checkPlayerModelLegalChanges],
        PlayerType: [
            validator.checkPlayerBalancePositive,
            validator.checkPlayerBalanceCannotDecrease,
        ],
        PlayerReviewType: validator.checkReviewGameIsInLibrary,
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class PlayerValidator {
    constructor(private services: SharedServices) {}

    /**
    *  legal player changes: 
    * - review
    * - add game to library (if player has money for new game)
    **/

    checkPlayerModelLegalChanges(model: PlayerModel, accept: ValidationAcceptor): void {
        const db = this.services.db.DatabaseService.getDB(model.player.name);
        //accept('info', 'Test message', { node: model.player });

        // check all games
        //const games = db.games.fo
    }

    // check that if any games are changed, it is adding a legal review
    checkGameChangeReview(game: PlayerGameType, accept: ValidationAcceptor): void {
        
    }

    checkPlayerBalancePositive(player: PlayerType, accept: ValidationAcceptor): void {
        if (player.balance < 0) {
            accept('error', 'Balance cannot be negative', { node: player, property: 'balance' });
        }
    }

    checkPlayerBalanceCannotDecrease(player: PlayerType, accept: ValidationAcceptor): void {
        const db = this.services.db.DatabaseService.getDB(player.name);
        console.log("DATABASE IS", db);

        const current_balance = db.players.find(p => p.name == player.name)?.balance;
        if (current_balance === undefined) {
            accept('warning', 'Player does not exist in database', { node: player });
            return;
        } else if (player.balance < current_balance) {
            accept('error', 'Balance cannot decrease', { node: player, property: 'balance' });
        }
    }

    checkReviewGameIsInLibrary(review: PlayerReviewType, accept: ValidationAcceptor): void {
        const games = review.author.ref.library.games.map(g => g.ref.name);

        if (!games.includes(review.$container.name)) {
            accept('error', 'Player must have game in library to write review', { node: review });
        }
    }

    // checkDiscountsDoNotOverlap(model: PlayerModel, accept: ValidationAcceptor): void {
    //     const discounts = AstUtils.streamAllContents(model)
    //         .filter(isPlayerDiscountType)
    //         .toArray();

    //     const discountsByGameMap = new Map<string, PlayerDiscountType[]>();
    //     for (const d of discounts) {
    //         const gameName = d.game.ref?.name;
    //         if (!discountsByGameMap.has(gameName)) {
    //             discountsByGameMap.set(gameName, []);
    //         }
    //         discountsByGameMap.get(gameName).push(d);
    //     }

    //     for (const [gameName, discounts] of discountsByGameMap) {
    //         const sorted = discounts.slice().sort(
    //             (a, b) =>
    //                 new Date(a.start_date).getTime() -
    //                 new Date(b.start_date).getTime()
    //         );

    //         for (let i = 0; i < sorted.length - 1; i++) {
    //             const current = sorted[i];
    //             const next = sorted[i + 1];

    //             const currentEnd = new Date(current.end_date);
    //             const nextStart = new Date(next.start_date);

    //             if (currentEnd >= nextStart) {
    //                 accept('error', `Overlapping discounts for game "${gameName}"`, {
    //                     node: next,
    //                     property: 'start_date'
    //                 });
    //             }
    //         }
    //     }
    // }

    // TODO: Add validation
    // checkTransactionAmountIsCorrect(transaction: PlayerTransactionType, accept: ValidationAcceptor): void {
    //     const container = transaction.$container;

    //     const allDiscounts = AstUtils.streamAllContents(container)
    //         .filter(isPlayerDiscountType)
    //         .filter(d => d.game == transaction.game)
    //         .toArray();

    //     for (const discount in allDiscounts){
    //         // const otherStart = new Date(discount.start_date);
    //         // const otherEnd = new Date(discount.end_date);
    //         // const discountStart = new Date(discount.start_date);
    //         // const discountEnd = new Date(discount.end_date);
    //     }
    // }
}
