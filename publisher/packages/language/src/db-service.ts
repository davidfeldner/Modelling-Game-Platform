import { databaseModel } from "./db-model.js";
import * as fs from 'node:fs';

export class DatabaseService {
    private readonly snapshotFolderPath = 'db_snapshots';

    getDB(userID: string): databaseModel | undefined {
        try {
            const snapshotFilePath = `${this.snapshotFolderPath}/${userID}.snapshot.json`;
            const dbData = fs.existsSync(snapshotFilePath) ? fs.readFileSync(snapshotFilePath, 'utf-8').toString() : '{}'
            const db: databaseModel = JSON.parse(dbData);
            return db;
        } catch {
            return undefined;
        }
    }
}
