import { databaseModel } from "./db-model.js";
import * as fs from 'node:fs';

type ModelType = 'player' | 'publisher' | 'administrator';

export class DatabaseService {
    private readonly snapshotFolderPath = 'db_snapshots';

    getDBSnapshot(fileType: ModelType, userID: string): databaseModel | undefined {
        try {
            const snapshotFilePath = `${this.snapshotFolderPath}/${userID}.${fileType}.snapshot.json`;
            if (!fs.existsSync(snapshotFilePath)) {
                return undefined;
            }
            const dbData = fs.readFileSync(snapshotFilePath, 'utf-8').toString();
            const db: databaseModel = JSON.parse(dbData);
            return db;
        } catch {
            return undefined;
        }
    }
}
