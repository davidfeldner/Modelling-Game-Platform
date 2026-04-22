import { AstUtils, type ValidationAcceptor, type ValidationChecks } from 'langium';
import { isPlayerDiscountType, PlayerType, PlayerReviewType, PlayerVersionType, PlayerTransactionType, type PublisherAstType, type PlayerDiscountType } from './generated/ast.js';
import { getDBState, type SharedServices } from './shared-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: SharedServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.PlayerValidator;
    const checks: ValidationChecks<PublisherAstType> = {
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
    checkPlayerBalancePositive(player: PlayerType, accept: ValidationAcceptor): void {
        if (player.balance < 0) {
            accept('error', 'Balance cannot be negative', { node: player, property: 'balance' });
        }
    }

    checkPlayerBalanceCannotDecrease(player: PlayerType, accept: ValidationAcceptor): void {
        const current_balance = getDBState()?.players.find(p => p.name == player.name)?.balance;

        if (current_balance !== undefined && player.balance < current_balance) {
            accept('error', 'Balance cannot decrease', { node: player, property: 'balance' });
        }
    }

    checkReviewGameIsInLibrary(review: PlayerReviewType, accept: ValidationAcceptor): void {
        const games = review.author.ref.library.games.map(g => g.ref.name);

        if (!games.includes(review.$container.name)) {
            accept('error', 'Player must have game in library to write review', { node: review });
        }
    }

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
