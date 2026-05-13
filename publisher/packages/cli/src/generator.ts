import type { PublisherModel, PlayerModel, AdministratorModel, SharedServices } from 'publisher-language';
import { expandToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { globalDiscountDSL, globalGenreDSL, globalReviewDSL, globalTransactionDSL, validateDBNotEmpty } from './util.js';
//import { getDiscountedPrice } from '../../language/src/shared-util.js'
import { databaseModel } from '../../language/src/db-model.js';

function getCurrentDB(dbPath: string): databaseModel {
    const dbData = fs.existsSync(dbPath) ? fs.readFileSync(dbPath).toString() : '{}';
    const db: databaseModel = JSON.parse(dbData);
    return db;
}

function saveDBSnapshotForClient(snapshot: databaseModel, userID: string) {
    const snapshotPath = `./db_snapshots/${userID}.snapshot.json`;
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot));
}

export function pushToDBPublisher(model: PublisherModel, dest?: string): string {
    const dbPath = dest || './db.json';
    const db = getCurrentDB(dbPath);

    let savedPublisher = db.publishers.find(p => p.name === model.publisher.name);
    let resolvedBalance = Math.max(model.publisher.balance, 0);
    // Add publisher if they do not exist in DB
    if (!savedPublisher) {
        let savedPublisher = {
            name: model.publisher.name,
            balance: model.publisher.balance
        }
        db.publishers.push(savedPublisher);
    } else if (resolvedBalance >= savedPublisher.balance) {
        savedPublisher.balance = resolvedBalance;
    }

    const existingGames = db.games.map(g => g.name)
    const createdGames = model.games.filter(g => !existingGames.includes(g.name))

    const requests = createdGames.map(g => {
        const currentVersion = g.versions.filter(v => v.is_current)[0]
        return {
            game: `${g.name}`,
            game_version: `${currentVersion.name}`,
            status: 'PENDING'
        };
    });

    db.requests.push(...requests)

    const existingGenres = db.genres.map(g => g.name)
    const createdGenres = model.genres.filter(g => !existingGenres.includes(g.name))

    db.genres.push(...createdGenres)

    const updates: databaseModel = { ...db };

    fs.writeFileSync(dbPath, JSON.stringify(updates));
    return dbPath;
}

export function pushToDBPlayer(model: PlayerModel, dest?: string): string {
    const dbPath = dest || './db.json';
    const db = getCurrentDB(dbPath);
    console.log("Pushing player to DB");

    let savedPlayer = db.players.find(p => p.name === model.player.name);
    let resolvedBalance = Math.max(model.player.balance, 0);
    // Add player if they do not exist in DB
    if (!savedPlayer) {
        let savedPlayer = {
            name: model.player.name,
            balance: resolvedBalance,
            library: { games: [] },
            transactions: []
        }
        db.players.push(savedPlayer);
    } else if (resolvedBalance >= savedPlayer.balance) {
        savedPlayer.balance = resolvedBalance;
    }

    const ownedGames = savedPlayer.library.games;
    const newGamesReferences = model.player.library.games.filter(g => !ownedGames.includes(g.ref.name));
    const newGames = newGamesReferences.map(g => db.games.find(game => game.name === g.ref.name));

    const totalCost = newGames.reduce((sum, g) => sum + g.price, 0);
    if (savedPlayer.balance >= totalCost) {
        const transactions = newGames.map(g => {
            const gamePrice = this.services.util.UtilService.getDiscountedPrice(g, db.sales, db.discounts);
            return {
                id: `${model.player.name}_buys_${g.name}`,
                date: new Date().toLocaleDateString("en-DE"),
                successful: true,
                amount: gamePrice,
                game: g.name
            };
        });

        savedPlayer.transactions.push(...transactions);
        savedPlayer.library.games.push(...newGames.map(g => g.name));

        savedPlayer.balance -= totalCost;
    }

    const updates: databaseModel = { ...db };

    fs.writeFileSync(dbPath, JSON.stringify(updates));
    return dbPath;
}

export function pushToDBAdministrator(model: AdministratorModel, dest?: string): string {
    const dbPath = dest || './db.json';
    const db = getCurrentDB(dbPath);


    let savedAdministrator = db.administrators.find(a => a.name === model.administrator.name);
    // Add administrator if they do not exist in DB
    if (!savedAdministrator) {
        let savedAdministrator = {
            name: model.administrator.name
        }
        db.administrators.push(savedAdministrator);
    }

    const alreadyApprovedRequests = db.requests.filter(r => r.status === 'APPROVED')
    const alreadyRejectedRequests = db.requests.filter(r => r.status === 'REJECTED')

    const newlyApprovedRequests = model.requests.filter(r => r.status === 'APPROVED' &&
        !alreadyApprovedRequests.some(ar => ar.game === r.game.ref.name && ar.game_version === r.game_version.ref.name))

    const newlyRejectedRequests = model.requests.filter(r => r.status === 'REJECTED' &&
        !alreadyApprovedRequests.some(ar => ar.game === r.game.ref.name && ar.game_version === r.game_version.ref.name))

    newlyApprovedRequests.forEach(req => {
        const game = db.games.find(g => g.name === req.game.ref.name)
        const version = game.versions.find(
            v => v.version_id === req.game_version.ref.name
        )
        version.approved = true
    })

    newlyRejectedRequests.forEach(req => {
        const game = db.games.find(g => g.name === req.game.ref.name)
        const version = game.versions.find(
            v => v.version_id === req.game_version.ref.name
        )
        version.approved = false
    })

    const updates: databaseModel = { ...db };

    fs.writeFileSync(dbPath, JSON.stringify(updates));
    return dbPath;
}

export function generateFromDB(fileType: string, userID: string, dest?: string): string {
    const dbPath = dest || './db.json';
    const json: databaseModel = getCurrentDB(dbPath);
    saveDBSnapshotForClient(json, userID);
    validateDBNotEmpty(json);

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

    const player = db.players.find(p => p.name == userID)
    if (!player) throw new Error(`Player with name ${userID} not found in DB`);
    dsl += `player ${`${player.name}`}\n`;
    dsl += `\tbalance ${player.balance}\n`;
    dsl += `\tlibrary [${player.library.games.join(', ')}]\n`;
    dsl += `\ttransactions\n\t${player.transactions.map(t => globalTransactionDSL(t)).join(', \n\t')}\n\n`;


    db.publishers.map(p => p.name).forEach(publisherName => {
        dsl += `publisher ${publisherName}\n`;
    });


    db.genres.forEach(genre => {
        dsl += globalGenreDSL(genre)
    });

    db.games.forEach(game => {
        // only show games that have a current version (hide unpublished games)
        if (game.versions.some(v => v.is_current)){
            dsl += `game ${`${game.name}`}\n`;
            dsl += `\tgenres ${game.genres.join(', ')}\n`;
            dsl += `\tpublisher ${`${game.publisher}`}\n`;
            dsl += `\tprice ${game.price}\n`;
            dsl += `\trelease_date ${game.release_date}\n`;
            dsl += `\tversions ${game.versions?.filter(v => v.is_current).map(v => `version_id "${v.version_id}" game_files "${v.game_files}"`).join(', ')}\n`;
            if (game.reviews?.length != 0) {
                dsl += `\treviews\n\t${game.reviews.map(r => globalReviewDSL(r)).join(',\n\t')}\n`
            }
            dsl += `\n`
        }
        
    });

    db.sales.forEach(sale => {
        dsl += `sale ${`${sale.name}`}\n`;
        dsl += `\tstart_date ${sale.start_date}\n`;
        dsl += `\tend_date ${sale.end_date}\n`
        dsl += `\tdiscounts ${sale.discounts.join(', ')}\n\n`;
    });

    db.discounts.forEach(discount => {
        dsl += globalDiscountDSL(discount)
    });

    return dsl;
}

function generatePublisherFile(db: databaseModel, userID: string): string {
    let dsl = '';

    const publisher = db.publishers.find(p => p.name == userID)
    if (!publisher) throw new Error(`Publisher with name ${userID} not found in DB`);
    dsl += `publisher ${publisher.name}\n`;
    dsl += `\tbalance ${publisher.balance}\n\n`;

    const publisherGames = db.games.filter(game => game.publisher == publisher.name)
    publisherGames.forEach(game => {
        dsl += `game ${game.name}\n`;
        dsl += `\tgenres ${game.genres.join(', ')}\n\n`;
        dsl += `\tpublisher ${game.publisher}\n`;
        dsl += `\tprice ${game.price}\n`;
        dsl += `\trelease_date ${game.release_date}\n`;
        dsl += `\tversions ${game.versions?.map(v => `version_id "${v.version_id}" game_files "${v.game_files}" is_current ${v.is_current} approved ${v.approved}`).join(', ')}\n`;
        if (game.reviews?.length != 0) {
            dsl += `\treviews\n\t${game.reviews.map(r => globalReviewDSL(r)).join(',\n\t')}\n`
        }
        dsl += `\n`
    });

    const publisherGameNames = publisherGames.map(g => g.name);
    db.requests.filter(req => req.game in publisherGameNames).forEach(request => {
        dsl += `approval request game ${request.game}\n`;
        dsl += `\tversion ${request}\n`;
    });

    db.sales.forEach(sale => {
        dsl += `sale ${sale.name}\n`;
        dsl += `\tstart_date ${sale.start_date}\n`;
        dsl += `\tend_date ${sale.end_date}\n`
        dsl += `\tdiscounts ${sale.discounts.join(', ')}\n\n`;
    });

    db.discounts.filter(discount => discount.game in publisherGameNames).forEach(discount => {
        dsl += globalDiscountDSL(discount)
    });

    db.genres.forEach(genre => {
        dsl += globalGenreDSL(genre)
    });

    return dsl;
}
function generateAdministratorFile(db: databaseModel, userID: string): string {
    let dsl = '';

    const administrator = db.administrators.find(a => a.name == userID)
    if (!administrator) throw new Error(`Administrator with name ${userID} not found in DB`);
    dsl += `administrator ${administrator.name}\n\n`;

    db.publishers.forEach(p => {
        dsl += `publisher ${p.name}\n`;
        dsl += `balance ${p.balance}\n\n`;
    });

    db.genres.forEach(genre => {
        dsl += globalGenreDSL(genre)
    });

    db.games.forEach(game => {
        dsl += `game ${game.name}\n`;
        dsl += `\tgenres ${game.genres.join(', ')}\n`;
        dsl += `\tpublisher ${game.publisher}\n`;
        dsl += `\tprice ${game.price}\n`;
        dsl += `\trelease_date ${game.release_date}\n`;
        dsl += `\tversions ${game.versions?.map(v => `version_id "${v.version_id}" game_files "${v.game_files}" is_current ${v.is_current} approved ${v.approved}`).join(', ')}\n`;
        if (game.reviews?.length != 0) {
            dsl += `\treviews\n\t${game.reviews.map(r => globalReviewDSL(r)).join(',\n\t')}\n`
        }
        dsl += `\n`
    });

    db.requests.forEach(request => {
        dsl += `approval request game ${request.game}\n`;
        dsl += `\tversion ${request.game_version}\n`;
        dsl += `\tstatus ${request.status}\n`;
    });

    db.sales.forEach(sale => {
        dsl += `sale ${sale.name}\n`;
        dsl += `\tstart_date ${sale.start_date}\n`;
        dsl += `\tend_date ${sale.end_date}\n`
        dsl += `\tdiscounts ${sale.discounts.join(', ')}\n\n`;
    });

    db.discounts.forEach(discount => {
        dsl += globalDiscountDSL(discount)
    });

    return dsl;
}