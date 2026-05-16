import * as langium from 'langium';
import { AstUtils, Reference, type ValidationAcceptor, type ValidationChecks } from 'langium';
import { PlayerModel, PlayerGameType, PlayerLibraryType, PlayerType, PlayerReviewType, type PublisherAstType, PlayerDiscountType, PlayerVersionType, PlayerGenreType } from './generated/ast.js';
import { type SharedServices } from './shared-module.js';
import type { databaseModel, DiscountType, GameType, GenreType, GenreTypeName, VersionType } from './db-model.d.ts';

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
        PlayerLibraryType: [
            validator.checkLibraryChange,
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

        const db = this.services.db.DatabaseService.getDBSnapshot(playerName);
        if (db === undefined) {
            accept('warning', 'Could not check cached player library. Try pulling first.', { node: library });
            return;
        }

        library.games.forEach(g => {
            this.checkGameChange(g.ref, accept);
        });

        const dbLibraryGames = db.players.find(p => p.name == playerName).library.games;
        const modelLibraryGames = library.games.map(g => g.ref.name);
        const removedGames = dbLibraryGames.filter(g => !modelLibraryGames.includes(g));
        if (removedGames.length != 0) {
            accept('error', 'Players cannot remove games from their library', { node: library });
        }

        const addedGames = modelLibraryGames.filter(g => !dbLibraryGames.includes(g));
        if (addedGames.length != 0) {
            const playerBalance = db.players.find(p => p.name == playerName).balance;
            let sum = 0;
            addedGames.forEach(g => {
                const game = db.games.find(i => i.name == g)
                sum += this.services.util.UtilService.getDiscountedPrice(game, db.sales, db.discounts);
            });
            if (sum > playerBalance) {
                accept('error', 'Price of new games in library exceeds player balance', { node: library });
            }
        }
    }


    checkGameChange(game: PlayerGameType, accept: ValidationAcceptor): void {
        console.log("specified game", game.name);
        const playerName = game.$container.player.name;

        const db = this.services.db.DatabaseService.getDBSnapshot(playerName);
        if (db === undefined) {
            accept('warning', 'Could not check cached games. Try pulling first.', { node: game });
            return;
        }

        const dbGame = db?.games.find(g => g.name == game.name);
        if (dbGame === undefined) {
            accept('error', 'Players cannot add new games', { node: game, property: 'name' });
        }
        console.log("Found game in DB", dbGame);

        if (game.release_date !== dbGame.release_date) {
            accept('error', 'Players cannot edit release date of game', { node: game, property: 'release_date' });
        }
        if (game.price !== dbGame.price) {
            accept('error', 'Players cannot edit price of game', { node: game, property: 'price' });
        }
        console.log("Game publisher is", game.publisher.ref.name, "DB game publisher is", dbGame.publisher)
        if (game.publisher.ref.name !== dbGame.publisher) {
            accept('error', 'Players cannot edit publisher of game', { node: game, property: 'publisher' });
        }

        // check reviews
        this.checkGameReviewsLegal(game, dbGame, playerName, accept);

        // check versions
        console.log("Game versions are", game.versions, "DB game versions are", dbGame.versions);
        if (this.hasGameVersionsChanged(game.versions, dbGame.versions)) {
            accept('error', 'Players cannot add edit game versions', { node: game, property: 'versions' });
        }

        // check genres 
        if (this.hasGameGenresChanged(game.genres, dbGame.genres)) {
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


    checkReviewGameIsInLibrary(review: PlayerReviewType, accept: ValidationAcceptor): void {
        const games = review.author.ref.library.games.map(g => g.ref.name);

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
        const db = this.services.db.DatabaseService.getDBSnapshot(player.name);
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
        const db = this.services.db.DatabaseService.getDBSnapshot(model.player.name);
        if (db === undefined) {
            accept('warning', 'Could not check cached data. Try pulling first.', { node: model });
            return;
        }

        const dbModel = this.services.util.UtilService.buildPlayerModelFromDBModel(db, model.player.name);
        const allowed = [
            'player.balance',
            'player.library.games[*]',
            'player.library.games[*].reviews[*]',
        ];
        this.assertNoUnauthorizedChanges(model, dbModel, allowed, accept, model);
    }


    assertNoUnauthorizedChanges(modelNode: any, dbModelNode: any, allowed: string[], accept: ValidationAcceptor, nodeForReport: any, path = ''): void {
        if (this.matches(path, allowed)) {
            return;
        }

        if (modelNode == null || dbModelNode == null || typeof modelNode !== 'object' || typeof dbModelNode !== 'object' || this.isLangiumRef(modelNode) || this.isLangiumRef(dbModelNode)) {
            if (this.normalizeNodeValue(modelNode) !== this.normalizeNodeValue(dbModelNode)) {
                accept('error', `Editing value not allowed ${this.normalizeNodeValue(modelNode)} vs ${this.normalizeNodeValue(dbModelNode)}`, { node: nodeForReport });
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
                    modelArray[i] ?? nodeForReport,
                    `${path}[${i}]`
                );
            }
            return;
        }

        // Use DB keys as the basis for comparison. First check keys present in DB (detect deletions/edits),
        // then detect any extra keys in the model (additions).
        const dbKeys = Object.keys(dbModelNode || {});
        const modelKeys = Object.keys(modelNode || {}).filter(k => !k.startsWith('$'));
        for (const k of dbKeys) {
            this.assertNoUnauthorizedChanges(
                modelNode && k in modelNode ? modelNode[k] : undefined,
                dbModelNode[k],
                allowed,
                accept,
                modelNode && k in modelNode ? modelNode[k] : nodeForReport,
                path ? `${path}.${k}` : k
            );
        }
        for (const k of modelKeys) {
            if (dbKeys.includes(k)) continue;
            this.assertNoUnauthorizedChanges(
                modelNode[k],
                undefined,
                allowed,
                accept,
                modelNode[k] ?? nodeForReport,
                path ? `${path}.${k}` : k
            );
        }
    }


    matches(path: string, allowed: string[]) {
        return allowed.some(p => p === path || new RegExp('^' + p.replace(/\./g, '\\.').replace(/\[\*\]/g, '\\[[0-9]+\\]')).test(path));
    }


    isLangiumRef(x: any): x is langium.Reference<any> {
        return x && typeof x === 'object' && 'ref' in x;
    }


    normalizeNodeValue(x: any) {
        if (this.isLangiumRef(x)) return this.normalizeNodeValue(x.ref);
        if (x == null) return x;
        if (typeof x !== 'object') return x;
        // Prefer common identity fields for comparison
        if ('name' in x && typeof x.name === 'string') return x.name;
        if ('id' in x && typeof x.id === 'string') return x.id;
        return x;
    }
}
