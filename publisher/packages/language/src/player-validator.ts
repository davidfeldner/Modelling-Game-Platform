import { AstUtils, Reference, type ValidationAcceptor, type ValidationChecks } from 'langium';
import { PlayerModel, PlayerGameType, PlayerType, PlayerReviewType, type PublisherAstType, PlayerDiscountType, PlayerVersionType, PlayerGenreType } from './generated/ast.js';
import { type SharedServices } from './shared-module.js';
import type { DiscountType, GameType, GenreType, GenreTypeName, VersionType } from './db-model.d.ts';

/**
 * Register custom validation checks.
 */
export function registerValidationChecksPlayer(services: SharedServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.PlayerValidator;
    const checks: ValidationChecks<PublisherAstType> = {
        PlayerType: [
            validator.checkPlayerBalancePositive,
            validator.checkPlayerBalanceCannotDecrease,
        ],
        PlayerGameType: [
            validator.checkGameChange
        ],
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class PlayerValidator {
    constructor(private services: SharedServices) { }

    /**
    *  legal player changes: 
    * - review
    * - add game to library (if player has money for new game)
    **/


    // check that if any games are changed, it is adding a legal review
    checkGameChange(game: PlayerGameType, accept: ValidationAcceptor): void {
        const db = this.services.db.DatabaseService.getDB(game.$container.player.name);
        const playerName = game.$container.player.name
        
        console.log("specified game", game.name )
        const dbGame = db.games.find(g => g.name == game.name)
        console.log("Found game in DB", dbGame)
        if (!dbGame) {
            accept('error', 'Players cannot add new games', { node: game, property: 'name' });
        }


        if (game.release_date !== dbGame.release_date) {
            accept('error', 'Players cannot edit release date of game', { node: game, property: 'release_date' });
        }
        if (game.price !== dbGame.price) {
            accept('error', 'Players cannot edit price of game', { node: game, property: 'price' });
        }
        console.log("Game publisher is", game.publisher.ref.name, "DB game publisher is", dbGame.publisher.name)
        if (game.publisher.ref.name !== dbGame.publisher.name) {
            accept('error', 'Players cannot edit publisher of game', { node: game, property: 'publisher' });
        }

        // check reviews
        this.checkGameReviewsLegal(game, dbGame, playerName, accept)

        // check versions
        console.log("Game versions are", game.versions, "DB game versions are", dbGame.versions)
        if(this.hasGameVersionsChanged(game.versions, dbGame.versions)) {
            accept('error', 'Players cannot add edit game versions', { node: game, property: 'versions' });
        }

        // check genres 
        if(this.hasGameGenresChanged(game.genres, dbGame.genres)) {
            accept('error', 'Players cannot add edit game genres', { node: game, property: 'genres' });
        }

    }


    checkGameReviewsLegal(game: PlayerGameType, dbGame: GameType, playerName: string, accept: ValidationAcceptor): void {
        if (dbGame.reviews.length !== game.reviews.length || this.hasReviewsChanged(game, dbGame)) {

            // Deleted reviews - present in DB but not in model
            dbGame.reviews.filter(
                dbReview => !game.reviews.some(
                    r => r.author.ref.name === dbReview.author.name && r.content === dbReview.content
                )
            ).forEach(r => {
                if (r.author.name !== playerName) {
                    accept('error', 'Players can only delete their own reviews', { node: game, property: 'reviews' });
                }
            });

            // New reviews - not present in DB but present in model
            game.reviews.filter(
                r => !dbGame.reviews.some(
                    dbReview => dbReview.author.name === r.author.ref.name && dbReview.content === r.content
                )
            ).forEach(r => this.checkReviewGameIsInLibrary(r, accept));

        }

    }


    hasReviewsChanged(game: PlayerGameType, dbGame: GameType): boolean {
        for (let i = 0; i < game.reviews.length; i++) {
            const dbReview = dbGame.reviews[i];
            const gameReview = game.reviews[i];

            if (dbReview.author.name !== gameReview.author.ref.name ||
                dbReview.content !== gameReview.content ||
                dbReview.is_flagged !== gameReview.is_flagged) {
                return true
            }
        }

        return false
    }

    hasGameVersionsChanged(versions: PlayerVersionType[], dbVersions: VersionType[]): boolean {
        for (let i = 0; i < versions.length; i++) {
            const modelVersion = versions[i];
            const dbVersion = dbVersions[i];

            if (modelVersion.name !== dbVersion.version_id || modelVersion.game_files !== dbVersion.game_files) {
                return true
            }
        }

        return false
    }

    hasGameGenresChanged(genres: Reference<PlayerGenreType>[], dbGenres: GenreTypeName[]): boolean {
        for (let i = 0; i < genres.length; i++) {
            const modelGenre = genres[i];
            const dbGenre = dbGenres[i];

            if (modelGenre.ref.name !== dbGenre) {
                return true
            }
        }

        return false
    }

    checkReviewGameIsInLibrary(review: PlayerReviewType, accept: ValidationAcceptor): void {
        const games = review.author.ref.library.games.map(g => g.ref.name);

        if (!games.includes(review.$container.name)) {
            accept('error', 'Player must have game in library to write review', { node: review });
        }
    }

    checkPlayerBalancePositive(player: PlayerType, accept: ValidationAcceptor): void {
        if (player.balance < 0) {
            accept('error', 'Balance cannot be negative', { node: player, property: 'balance' });
        }
    }

    checkPlayerBalanceCannotDecrease(player: PlayerType, accept: ValidationAcceptor): void {
        const db = this.services.db.DatabaseService.getDB(player.name);

        const current_balance = db.players.find(p => p.name == player.name)?.balance;
        if (current_balance === undefined) {
            accept('warning', 'Player does not exist in database. You have to push first.', { node: player });
            return;
        } else if (player.balance < current_balance) {
            accept('error', 'Balance cannot decrease', { node: player, property: 'balance' });
        }
    }
}
