import type { PublisherModel, PlayerModel, AdministratorModel } from 'publisher-language';
import { expandToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { globalDiscountDSL, globalGenreDSL } from './util.js';
import { databaseModel } from '../../language/src/db-model.js';

function getCurrentDB(dbPath: string): databaseModel {
    const dbData = fs.existsSync(dbPath) ? fs.readFileSync(dbPath).toString() : '{}';
    const db: databaseModel = JSON.parse(dbData);
    return db;
}

function saveDBSnapshotForClient(snapshot: databaseModel, userID: string) {
    const snapshotPath = `../language/src/db_snapshots/${userID}.snapshot.json`;
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot));
}

export function pushToDBPublisher(model: PublisherModel, dest?: string): string {
    const dbPath = dest || './db.json';
    const db = getCurrentDB(dbPath);

    const updates: databaseModel = { ...db };

    fs.writeFileSync(dbPath, JSON.stringify(updates));
    return dbPath;
}

export function pushToDBPlayer(model: PlayerModel, dest?: string): string {
    const dbPath = dest || './db.json';
    const db = getCurrentDB(dbPath);

    let savedPlayer = db.players.find(p => p.name === model.player.name)
    // Add player if they do not exist in DB
    if (!savedPlayer) {
        let savedPlayer = {
            name: model.player.name,
            balance: model.player.balance,
            library: { games: [] },
            transactions: []
        }
        db.players.push(savedPlayer);
    }

    const ownedGames = savedPlayer.library.games.map(g => g.name);
    const newGamesReferences = model.player.library.games.filter(g => !ownedGames.includes(g.ref.name));
    const newGames = newGamesReferences.map(g => db.games.find(game => game.name === g.ref.name))

    const transactions = newGames.map(g => ({
        id: `${model.player.name} buys ${g.name}`,
        date: new Date().toISOString(),
        successful: true,
        amount: g.price, // TODO: Apply discounts
        game: g.name
    }));

    savedPlayer.transactions.push(...transactions);
    savedPlayer.library.games.push(...newGames);

    const updates: databaseModel = { ...db };

    fs.writeFileSync(dbPath, JSON.stringify(updates));
    return dbPath;
}

export function pushToDBAdministrator(model: AdministratorModel, dest?: string): string {
    const dbPath = dest || './db.json';
    const db = getCurrentDB(dbPath);
    

    const updates: databaseModel = { ...db };

    fs.writeFileSync(dbPath, JSON.stringify(updates));
    return dbPath;
}

export function generateFromDB(fileType: string, userID: string, dest?: string): string {
    const dbPath = dest || './src/db.json';
    const json: databaseModel = getCurrentDB(dbPath);
    saveDBSnapshotForClient(json, userID);

    let generatedFile = "";
    if (fileType === 'player') {
        generatedFile = generatePlayerFile(json, userID);
    } else if (fileType === 'publisher') {
        generatedFile = generatePublisherFile(json, userID);
    } else if (fileType === 'administrator') {
        generatedFile = generateAdministratorFile(json, userID);
    } else {
        throw new Error(`Unknown file type: ${fileType}`);
    }
    const path = dest || `./${fileType}_${userID}.${fileType}`;
    fs.writeFileSync(path, generatedFile);
    return path;
}

function generatePlayerFile(db: databaseModel, userID: string): string {
    let dsl = '';

    if (db.games) {
        db.games.forEach(game => {
            dsl += `game ${`"${game.name}"`}\n`;
            dsl += `\tgenres ${game.genres?.map(
                g => globalGenreDSL(g))
                .join(', ')}\n\n`;
            dsl += `\tpublisher ${`"${game.publisher.name}"`}\n`;
            dsl += `\tprice ${game.price}\n`;
            dsl += `\trelease_date ${game.release_date}\n`;
            dsl += `\tversions ${game.versions?.map(v => `version_id "${v.ID}" game_files "${v.game_files}"`).join(', ')}\n\n`;
        });
    }

    if (db.players) {
        db.players.filter(p => p.name == userID)
            .forEach(player => {
                dsl += `player ${`"${player.name}"`}\n`;
                dsl += `\tbalance ${player.balance}\n`;
                dsl += `\tlibrary ${player.library.games.join(', ')}\n\n`;
            });
    }

    if (db.sales) {
        db.sales.forEach(sale => {
            dsl += `sale ${`"${sale.name}"`}\n`;
            dsl += `\tstart_date ${`"${sale.start_date}"`}\n`;
            dsl += `\tend_date ${`"${sale.end_date}"`}\n`
            dsl += `\tdiscounts ${sale.discounts?.map(
                d => globalDiscountDSL(d))
                .join(', ')}\n\n`;
        });
    }

    if (db.discounts) {
        db.discounts.forEach(discount => {
            dsl += globalDiscountDSL(discount)
        });
    }



    return dsl;
}

function generatePublisherFile(db: databaseModel, userID: string): string {
    let dsl = '';

    if (db.games) {
        db.games.forEach(game => {
            dsl += `game ${`"${game.name}"`}\n`;
            dsl += `\tgenres ${game.genres?.map(
                g => globalGenreDSL(g))
                .join(', ')}\n\n`;
            dsl += `\tpublisher ${`"${game.publisher.name}"`}\n`;
            dsl += `\tprice ${game.price}\n`;
            dsl += `\trelease_date ${game.release_date}\n`;
            dsl += `\tstate ${game.state}\n`;
            dsl += `\tversions ${game.versions?.map(v => `version_id "${v.ID}" game_files "${v.game_files}" is_current "${v.is_current}" approved "${v.approved}"`).join(', ')}\n\n`;
        });
    }

    if (db.publishers) {
        db.publishers.filter(p => p.name == userID)
            .forEach(publisher => {
                dsl += `publisher ${`"${publisher.name}"`}\n`;
            });
    }

    if (db.requests) {
        db.requests.forEach(request => {
            dsl += `approval request game ${`"${request.game.name}"`}\n`;
            dsl += `\tversion ${`"${request.version}"`}\n`;
        });
    }

    if (db.sales) {
        db.sales.forEach(sale => {
            dsl += `sale ${`"${sale.name}"`}\n`;
            dsl += `\tstart_date ${`"${sale.start_date}"`}\n`;
            dsl += `\tend_date ${`"${sale.end_date}"`}\n`
            dsl += `\tdiscounts ${sale.discounts?.map(
                d => globalDiscountDSL(d))
                .join(', ')}\n\n`;
        });
    }

    if (db.discounts) {
        db.discounts.forEach(discount => {
            dsl += globalDiscountDSL(discount)
        });
    }

    if (db.genres) {
        db.genres.forEach(genre => {
            dsl += globalGenreDSL(genre)
        });
    }

    return dsl;
}
function generateAdministratorFile(db: databaseModel, userID: string): string {
    let dsl = '';


    if (db.games) {
        db.games.forEach(game => {
            dsl += `game ${`"${game.name}"`}\n`;
            dsl += `\tgenres ${game.genres?.map(
                g => globalGenreDSL(g))
                .join(', ')}\n\n`;
            dsl += `\tpublisher ${`"${game.publisher.name}"`}\n`;
            dsl += `\tprice ${game.price}\n`;
            dsl += `\trelease_date ${game.release_date}\n`;
            dsl += `\tstate ${game.state}\n`;
            dsl += `\tversions ${game.versions?.map(v => `version_id "${v.ID}" game_files "${v.game_files}" is_current "${v.is_current}" approved "${v.approved}"`).join(', ')}\n\n`;
        });
    }

    if (db.administrators) {
        db.administrators.filter(a => a.name == userID)
            .forEach(administrator => {
                dsl += `administrator ${`"${administrator.name}"`}\n`;
            });
    }

    if (db.requests) {
        db.requests.forEach(request => {
            dsl += `approval request game ${`"${request.game.name}"`}\n`;
            dsl += `\tversion ${`"${request.version}"`}\n`;
            dsl += `\tstatus ${`"${request.status}"`}\n`;
        });
    }

    if (db.sales) {
        db.sales.forEach(sale => {
            dsl += `sale ${`"${sale.name}"`}\n`;
            dsl += `\tstart_date ${`"${sale.start_date}"`}\n`;
            dsl += `\tend_date ${`"${sale.end_date}"`}\n`
            dsl += `\tdiscounts ${sale.discounts?.map(
                d => globalDiscountDSL(d))
                .join(', ')}\n\n`;
        });
    }

    if (db.discounts) {
        db.discounts.forEach(discount => {
            dsl += globalDiscountDSL(discount)
        });
    }

    return dsl;
}