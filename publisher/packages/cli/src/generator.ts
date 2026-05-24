import type { PublisherModel, PlayerModel, AdministratorModel } from 'publisher-language';
import * as fs from 'node:fs';
import { globalDiscountDSL, globalGenreDSL, globalReviewDSL, globalTransactionDSL, validateDBNotEmpty, formatDateTime } from './util.js';
import { UtilService } from '../../language/out/shared-util.js'
import { databaseModel } from '../../language/src/db-model.js';

const services = {
    utilService: new UtilService(),
};

const emptyDb: databaseModel = {
    discounts: [],
    games: [],
    publishers: [],
    administrators: [],
    players: [],
    genres: [],
    requests: [],
    sales: [],
    reviews: [],
    transactions: []
}

function getCurrentDB(dbPath: string): databaseModel {
    let dbData: string;
    if (!fs.existsSync(dbPath))
        fs.writeFileSync(dbPath, JSON.stringify(emptyDb))
    dbData = fs.readFileSync(dbPath).toString();
    const db: databaseModel = JSON.parse(dbData);
    validateDBNotEmpty(db); // Validates that expected values are in database, as assumed in cast to databaseModel

    return db;
}

function saveDBSnapshotForClient(snapshot: databaseModel, fileType: string, userID: string) {
    if (!fs.existsSync("./db_snapshots/")) fs.mkdirSync("./db_snapshots")
    const snapshotPath = `./db_snapshots/${userID}.${fileType}.snapshot.json`;
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot));
}

export function pushToDBPlayer(model: PlayerModel, dbPath = './db.json'): string {
    const db = getCurrentDB(dbPath);
    console.log("Pushing player to DB");

    let savedPlayer = db.players.find(p => p.name === model.player.name);
    let resolvedBalance = Math.max(model.player.balance, 0);
    // Add player if they do not exist in DB
    if (!savedPlayer) {
        savedPlayer = {
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

    const totalCost = newGames.reduce((sum, g) => sum + services.utilService.getDiscountedPrice(g, db.sales, db.discounts), 0);
    if (savedPlayer.balance >= totalCost) {
        const transactions = newGames.map(g => {
            const gamePrice = services.utilService.getDiscountedPrice(g, db.sales, db.discounts);
            return {
                id: `${model.player.name}_buys_${g.name}`,
                date: formatDateTime(new Date()),
                successful: true,
                amount: gamePrice,
                game: g.name
            };
        });

        newGames.forEach(g => {
            db.publishers.find(p => p.name === g.publisher).balance += services.utilService.getDiscountedPrice(g, db.sales, db.discounts);
            g.purchased_count += 1
        });

        savedPlayer.transactions.push(...transactions);
        savedPlayer.library.games.push(...newGames.map(g => g.name));
        savedPlayer.balance -= totalCost;

    }

    model.games.forEach(game => {
        const dbGame = db.games.find(g => g.name === game.name)!;
        const review = game.reviews.find(r => r.author === model.player.name);
        if (review) {
            const existingReview = dbGame.reviews.find(r => r.author === model.player.name);
            if (existingReview) {
                existingReview.is_flagged = review.content != existingReview.content ? false : true
                existingReview.content = review.content;
            } else {
                dbGame.reviews.push({
                    author: model.player.name,
                    content: review.content,
                    is_flagged: false
                })
            }
        } else if (dbGame.reviews.some(r => r.author === model.player.name)) {
            dbGame.reviews = dbGame.reviews.filter(r => r.author !== model.player.name);
        }
    })

    const updates: databaseModel = { ...db };

    fs.writeFileSync(dbPath, JSON.stringify(updates));
    return dbPath;
}

export function pushToDBPublisher(model: PublisherModel, dbPath = './db.json'): string {
    const db = getCurrentDB(dbPath);
    console.log("Pushing publisher to DB");

    let savedPublisher = db.publishers.find(p => p.name === model.publisher.name);
    let resolvedBalance = Math.max(model.publisher.balance, 0);
    // Add publisher if they do not exist in DB
    if (!savedPublisher) {
        savedPublisher = {
            name: model.publisher.name,
            balance: model.publisher.balance
        }
        db.publishers.push(savedPublisher);
    } else if (resolvedBalance >= savedPublisher.balance) {
        savedPublisher.balance = resolvedBalance;
    }

    const existingGames = db.games.map(g => g.name);
    const createdGames = model.games.filter(g => !existingGames.includes(g.name));

    const requests = createdGames.map(g => {
        const newVersion = g.versions.filter(v => v.is_current)[0]
        return {
            game: `${g.name}`,
            game_version: `${newVersion.name}`,
            status: 'PENDING'
        };
    });

    db.games.forEach(g => {
        const modelGame = model.games.find(game => game.name == g.name)
        if (!modelGame) return; // skip if modelgame does not exist
        const dbGameVersions = g.versions.map(v => v.version_id)
        const newVersions = modelGame.versions.filter(v => !dbGameVersions.includes(v.name) && !v.approved)
        newVersions.forEach(v => {
            requests.push({
                game: `${g.name}`,
                game_version: `${v.name}`,
                status: 'PENDING'
            });
        })
    })

    const gamesChangedOrAdded = model.games.map(g => ({
        name: g.name,
        release_date: g.release_date,
        price: g.price,
        versions: g.versions.map(v => ({
            version_id: v.name,
            game_files: v.game_files,
            is_current: v.is_current,
            approved: v.approved
        })),
        genres: g.genres.map(genre => genre.ref.name),
        publisher: model.publisher.name,
        reviews: db.games.find(game => game.name == g.name)?.reviews ?? [], // ignore changes to reviews
        purchased_count: g.purchased_count ?? 0
    }));

    db.games = [
        ...db.games.filter(g => !gamesChangedOrAdded.some(cg => cg.name === g.name)),
        ...gamesChangedOrAdded
    ];
    db.requests.push(...requests)

    const existingGenres = db.genres.map(g => g.name);
    const createdGenres = model.genres
        .filter(g => !existingGenres.includes(g.name))
        .map(g => ({
            name: g.name,
            description: g.description
        }));

    db.genres.push(...createdGenres);

    const publisherGames = new Set(
        db.games
            .filter(g => g.publisher === savedPublisher.name)
            .map(g => g.name)
    );

    const existingNames = new Set(db.discounts.map(d => d.name));
    const incomingNames = new Set(model.discounts.map(d => d.name));

    const added = model.discounts.filter(d => !existingNames.has(d.name));
    const removed = db.discounts.filter(d => !incomingNames.has(d.name));

    if (added.some(d => !publisherGames.has(d.game.ref.name))) {
        throw new Error("Publishers cannot create discounts for games they do not publish");
    }

    const discountsForOtherPublishers = db.discounts.filter(d => !publisherGames.has(d.game));


    // Add/update only this publisher's discounts
    const publisherDiscounts = model.discounts.map(d => ({
        name: d.name,
        game: d.game.ref.name,
        percentage: d.percentage,
        start_date: d.start_date,
        end_date: d.end_date
    }));

    db.discounts = [...discountsForOtherPublishers, ...publisherDiscounts];

    const updates: databaseModel = { ...db };

    console.dir(db, { depth: null });
    console.dir(updates, { depth: null });

    fs.writeFileSync(dbPath, JSON.stringify(updates));
    return dbPath;
}

export function pushToDBAdministrator(model: AdministratorModel, dbPath = './db.json'): string {
    const db = getCurrentDB(dbPath);
    console.log("Pushing administrator to DB");

    let savedAdministrator = db.administrators.find(a => a.name === model.administrator.name);
    // Add administrator if they do not exist in DB
    if (!savedAdministrator) {
        savedAdministrator = {
            name: model.administrator.name
        }
        db.administrators.push(savedAdministrator);
    }

    const alreadyApprovedRequests = db.requests.filter(r => r.status === 'APPROVED')
    const alreadyRejectedRequests = db.requests.filter(r => r.status === 'REJECTED')

    const newlyApprovedRequests = model.requests.filter(r => r.status === 'APPROVED' &&
        !alreadyApprovedRequests.some(ar => ar.game === r.game.ref.name && ar.game_version === r.game_version.ref.name))

    const newlyRejectedRequests = model.requests.filter(r => r.status === 'REJECTED' &&
        !alreadyRejectedRequests.some(ar => ar.game === r.game.ref.name && ar.game_version === r.game_version.ref.name))

    newlyApprovedRequests.forEach(req => {
        const game = db.games.find(g => g.name === req.game.ref.name)
        const version = game.versions.find(
            v => v.version_id === req.game_version.ref.name
        )
        version.approved = true
        db.requests.find(r => r.game === req.game.ref.name && r.game_version === req.game_version.ref.name).status = 'APPROVED';
    })

    newlyRejectedRequests.forEach(req => {
        const game = db.games.find(g => g.name === req.game.ref.name)
        const version = game.versions.find(
            v => v.version_id === req.game_version.ref.name
        )
        version.approved = false
        db.requests.find(r => r.game === req.game.ref.name && r.game_version === req.game_version.ref.name).status = 'REJECTED';
    })

    model.games.forEach(game => {
        const dbGame = db.games.find(g => g.name === game.name);
        game.reviews.forEach(review => {
            const existingReview = dbGame.reviews.find(r => r.author === review.author);
            if (existingReview.is_flagged != review.is_flagged) {
                existingReview.is_flagged = review.is_flagged;
            }
        })
    })

    db.sales = model.sales.map(d => ({
        name: d.name,
        start_date: d.start_date,
        end_date: d.end_date,
        discounts: d.discounts.map(discount => discount.ref.name)
    }));

    const updates: databaseModel = { ...db };

    fs.writeFileSync(dbPath, JSON.stringify(updates));
    return dbPath;
}

export function createUser(userType: string, userID: string, dbPath = './db.json'): void {
    const db = getCurrentDB(dbPath);
    if (userType === 'player') {
        if (db.players.some(p => p.name === userID)) {
            throw new Error(`Player with name ${userID} already exists in DB`);
        }
        db.players.push({
            name: userID,
            balance: 0,
            library: { games: [] },
            transactions: []

        });
    } else if (userType === 'publisher') {
        if (db.publishers.some(p => p.name === userID)) {
            throw new Error(`Publisher with name ${userID} already exists in DB`);
        }
        db.publishers.push({
            name: userID,
            balance: 0
        });
    } else if (userType === 'administrator') {
        if (db.administrators.some(a => a.name === userID)) {
            throw new Error(`Administrator with name ${userID} already exists in DB`);
        }
        db.administrators.push({
            name: userID
        });
    } else {
        throw new Error(`Unknown user type: ${userType}`);
    }
    fs.writeFileSync(dbPath, JSON.stringify(db));
}

export function generateFromDB(fileType: string, userID: string, dbPath = './db.json', clientFilePath?: string): string {
    const json: databaseModel = getCurrentDB(dbPath);
    saveDBSnapshotForClient(json, fileType, userID);

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
    const path = clientFilePath || `./${userID}.${fileType}`;
    fs.writeFileSync(path, generatedFile);
    return path;
}

function generatePlayerFile(db: databaseModel, userID: string): string {
    let dsl = '';

    const player = db.players.find(p => p.name == userID)
    if (!player) throw new Error(`Player with name ${userID} not found in DB`);

    const publishedGameNames = db.games.filter(g => g.versions.some(v => v.is_current && v.approved)).map(g => g.name);
    dsl += `player ${`${player.name}`}\n`;
    dsl += `\tbalance ${player.balance}\n`;
    dsl += `\tlibrary [${player.library.games.filter(g => publishedGameNames.includes(g)).join(', ')}]\n`;
    if (player.transactions && player.transactions.length != 0)
        dsl += `\ttransactions\n\t${player.transactions.map(t => globalTransactionDSL(t)).join(', \n\t')}`;
    dsl += `\n\n`;

    db.publishers.map(p => p.name).forEach(publisherName => {
        dsl += `publisher ${publisherName}\n\n`;
    });

    db.genres.forEach(genre => {
        dsl += globalGenreDSL(genre)
    });

    db.games.forEach(game => {
        // only show games that have a current version (hide unpublished games)
        if (publishedGameNames.includes(game.name)) {
            dsl += `game ${`${game.name}`}\n`;
            dsl += `\tgenres ${game.genres.join(', ')}\n`;
            dsl += `\tpublisher ${`${game.publisher}`}\n`;
            dsl += `\tprice ${game.price}\n`;
            dsl += `\trelease_date ${game.release_date}\n`;
            dsl += `\tversions\n\t${game.versions?.filter(v => v.is_current).map(v => `\tversion_id "${v.version_id}" game_files "${v.game_files}"`).join(',\n\t')}\n`;
            const notFlaggedOrOwnReviews = game.reviews.filter(r => !r.is_flagged || r.author === userID)
            if (notFlaggedOrOwnReviews.length != 0) {
                // Show not flagged reviews and player's own flagged reviews
                dsl += `\treviews\n\t${notFlaggedOrOwnReviews.map(r => globalReviewDSL(r)).join(',\n\t')}\n`
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

    db.discounts.filter(d => publishedGameNames.includes(d.game))
        .forEach(discount => {
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
        dsl += `\tgenres ${game.genres.join(', ')}\n`;
        dsl += `\tpublisher ${game.publisher}\n`;
        dsl += `\tprice ${game.price}\n`;
        dsl += `\trelease_date ${game.release_date}\n`;
        dsl += `\tversions\n\t${game.versions?.map(v => `\tversion_id "${v.version_id}" game_files "${v.game_files}" is_current ${v.is_current} approved ${v.approved}`).join(',\n\t')}\n`;
        const notFlaggedReviews = game.reviews.filter(r => !r.is_flagged)
        if (notFlaggedReviews.length != 0) {
            // Only show non-flagged reviews to publishers
            dsl += `\treviews\n\t${notFlaggedReviews.map(r => globalReviewDSL(r)).join(',\n\t')}\n`;
        }
        dsl += `\tpurchased_count ${game.purchased_count}\n`;
        dsl += `\n`
    });

    const publisherGameNames = publisherGames.map(g => g.name);


    const salesIncludingPublisherGames = db.sales.filter(sale =>
        sale.discounts.some(discountName => {
            const discount = db.discounts.find(d => d.name === discountName);
            return discount && publisherGameNames.includes(discount.game);
        })
    );

    // only show sales that includes publisher games
    salesIncludingPublisherGames.forEach(sale => {
        dsl += `sale ${sale.name}\n`;
        dsl += `\tstart_date ${sale.start_date}\n`;
        dsl += `\tend_date ${sale.end_date}\n`
        dsl += `\tdiscounts ${sale.discounts.join(', ')}\n\n`;
    });

    db.discounts.filter(discount => publisherGameNames.includes(discount.game)).forEach(discount => {
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
        dsl += `\tbalance ${p.balance}\n\n`;
    });

    db.players.forEach(p => {
        dsl += `player ${p.name}\n`;
        dsl += `\tbalance ${p.balance}\n`;
        if (p.transactions && p.transactions.length != 0) {
            dsl += `\ttransactions\n\t${p.transactions.map(t => globalTransactionDSL(t)).join(', \n\t')}\n`;
        }
        dsl += `\n`
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
        dsl += `\tversions\n\t${game.versions?.map(v => `\tversion_id "${v.version_id}" game_files "${v.game_files}" is_current ${v.is_current} approved ${v.approved}`).join(',\n\t')}\n`;
        if (game.reviews?.length != 0) {
            dsl += `\treviews\n\t${game.reviews.map(r => globalReviewDSL(r)).join(',\n\t')}\n`
        }
        dsl += `\n`
    });

    db.requests.forEach(request => {
        dsl += `approval request game ${request.game}\n`;
        dsl += `\tversion "${request.game_version}"\n`;
        dsl += `\tstatus ${request.status}\n\n`;
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
