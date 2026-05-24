import { Reference, type ValidationAcceptor, type ValidationChecks } from 'langium';
import { PlayerModel, PlayerGameType, PlayerLibraryType, PlayerType, PlayerReviewType, type PublisherAstType, PlayerVersionType, PlayerGenreType } from './generated/ast.js';
import { type SharedServices } from './shared-module.js';
import type { GameType, GenreTypeName, VersionType } from './db-model.ts';

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
            //validator.checkPlayerNameUnique,
        ],
        PlayerLibraryType: [
            validator.checkLibraryChange,
        ],
        PlayerReviewType: [
            validator.checkGameReviewsLegal,
        ],
        PlayerModel: [
            validator.checkNoUnauthorizedChanges,
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
    * - add review on owned game
    * - add game to library (if player has money for new game)
    **/

    checkLibraryChange(library: PlayerLibraryType, accept: ValidationAcceptor): void {
        const playerName = library.$container.name;
        
        const db = this.services.db.DatabaseService.getDBSnapshot("player", playerName);
        if (db === undefined) {
            accept('warning', 'Could not check cached player library. Try pulling first.', { node: library });
            return;
        }
        const dbPlayer = db.players.find(p => p.name == playerName)
        if (!dbPlayer) {
            accept('warning', 'Could not find player in db, push first.', { node: library });
            return;
        }

        // Check for duplicate games in library
        const gameNames = library.games.map(g => g.ref.name);
        const uniqueGames = new Set(gameNames);
        if (uniqueGames.size !== gameNames.length) {
            // Find which games are duplicated
            const duplicates = gameNames.filter((name, index) => gameNames.indexOf(name) !== index);
            accept('error', `Library contains duplicate games: ${[...new Set(duplicates)].join(', ')}`, { node: library });
        }


        const publishedGameNames = db.games.filter(g => g.versions.some(v => v.is_current && v.approved)).map(g => g.name);
        const dbLibraryGames = dbPlayer.library.games.filter(g => publishedGameNames.includes(g));
        const modelLibraryGames = library.games.map(g => g.ref.name);
        const removedGames = dbLibraryGames.filter(g => !modelLibraryGames.includes(g));
        if (removedGames.length != 0) {
            accept('error', 'Players cannot remove games from their library', { node: library });
        }

        const addedGames = modelLibraryGames.filter(g => !dbLibraryGames.includes(g));
        if (addedGames.length != 0) {
            const playerBalance = dbPlayer.balance;
            let sum = 0;
            addedGames.forEach(g => {
                const game = db.games.find(i => i.name == g);
                sum += this.services.util.UtilService.getDiscountedPrice(game, db.sales, db.discounts);

            });
            if (sum > playerBalance) {
                accept('error', 'Price of new games in library exceeds player balance', { node: library });
            }
        }
    }


    checkGameReviewsLegal(review: PlayerReviewType, accept: ValidationAcceptor): void {
        const model = review.$container.$container
        const playerName = model.player.name

        const db = this.services.db.DatabaseService.getDBSnapshot("player", playerName);
        if (db === undefined) {
            accept('warning', 'Could not check cached game review. Try pulling first.', { node: review });
            return;
        }

        const game = review.$container
        const dbGame = db?.games.find(g => g.name == game.name);

        if (dbGame.reviews.length !== game.reviews.length || this.hasReviewsChanged(game, dbGame)) {
            // Deleted reviews - present in DB but not in model
            dbGame.reviews.filter(
                dbReview => !game.reviews.some(r => r.author === dbReview.author)
            ).forEach(r => {
                if (r.author !== playerName) {
                    accept('error', 'Players can only delete their own reviews', { node: game, property: 'reviews' });
                }
            });

            const existingReviews = game.reviews.filter(r => dbGame.reviews.map(dbReview => dbReview.author).includes(r.author));
            const duplicateAuthors = existingReviews
                .map(r => r.author)
                .filter((author, index, authors) => authors.indexOf(author) !== index);
            if (duplicateAuthors.length > 0) {
                accept('error', 'Players can only write one review per game', { node: game, property: 'reviews' });
            }
            for (const review of existingReviews) {
                const dbReview = dbGame.reviews.find(dbReview => dbReview.author === review.author);
                if (!dbReview) continue;

                if (review.author !== playerName && (review.content !== dbReview.content || review.is_flagged !== dbReview.is_flagged)) {
                    accept('error', 'Players can only edit their own reviews', { node: review });
                    continue;
                }
            }

            // New reviews - not present in DB but present in model
            game.reviews.filter(
                r => !dbGame.reviews.some(dbReview => dbReview.author === r.author)
            ).forEach(r => {
                if (r.author !== playerName) {
                    accept('error', 'Players can only write reviews for themselves', { node: r });
                }
                this.checkReviewGameIsInLibrary(r, accept);
            });

        }
    }


    hasReviewsChanged(game: PlayerGameType, dbGame: GameType): boolean {
        for (let i = 0; i < game.reviews.length; i++) {
            const dbReview = dbGame.reviews[i];
            const gameReview = game.reviews[i];

            if (dbReview.author !== gameReview.author ||
                dbReview.content !== gameReview.content ||
                dbReview.is_flagged !== gameReview.is_flagged) {
                return true
            }
        }

        return false
    }


    checkReviewGameIsInLibrary(review: PlayerReviewType, accept: ValidationAcceptor): void {
        const games = review.$container.$container.player.library.games.map(g => g.ref.name);

        if (!games.includes(review.$container.name)) {
            accept('error', 'Player must have game in library to write review', { node: review });
        }
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


    checkPlayerBalancePositive(player: PlayerType, accept: ValidationAcceptor): void {
        if (player.balance < 0) {
            accept('error', 'Balance cannot be negative', { node: player, property: 'balance' });
        }
    }


    checkPlayerBalanceCannotDecrease(player: PlayerType, accept: ValidationAcceptor): void {
        const db = this.services.db.DatabaseService.getDBSnapshot("player", player.name);
        if (db === undefined) {
            accept('warning', 'Could not check cached player balance. Try pulling first.', { node: player });
            return;
        }

        const current_balance = db?.players.find(p => p.name == player.name)?.balance;
        if (player.balance < current_balance) {
            accept('error', 'Balance cannot decrease', { node: player, property: 'balance' });
        }
    }


    checkNoUnauthorizedChanges(model: PlayerModel, accept: ValidationAcceptor): void {
        const db = this.services.db.DatabaseService.getDBSnapshot("player", model.player.name);
        if (db === undefined) {
            accept('warning', 'Could not check cached data. Try pulling first.', { node: model });
            return;
        }
        const dbModel = this.services.util.UtilService.buildPlayerModelFromDBModel(db, model.player.name);
        if (dbModel === undefined) {
            accept('warning', 'Could not get data from DB, is the user in the db?', { node: model });
            return;
        }

        const allowed = [
            { path: 'player.balance', exactMatch: true },
            { path: 'player.library.games[*]', exactMatch: false },
            { path: 'games[*].reviews[*]', exactMatch: false },
        ];
        this.services.util.UtilService.assertNoUnauthorizedChanges(model, dbModel, accept, model, allowed);
    }
}
