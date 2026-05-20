import { beforeAll, describe, expect, test } from "vitest";
import { EmptyFileSystem, type LangiumDocument } from "langium";
import { expandToString as s } from "langium/generate";
import { parseHelper } from "langium/test";
import type { Diagnostic } from "vscode-languageserver-types";
import type { PlayerModel } from "publisher-language";
import { createSharedServices, isPublisherModel } from "publisher-language";

let services: ReturnType<typeof createSharedServices>;
let parse:    ReturnType<typeof parseHelper<PlayerModel>>;
let document: LangiumDocument<PlayerModel> | undefined;

beforeAll(async () => {
    services = createSharedServices(EmptyFileSystem);
    const doParse = parseHelper<PlayerModel>(services.Publisher);
    parse = (input: string) => doParse(input, { validation: true });

    // activate the following if your linking test requires elements from a built-in library, for example
    // await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
});

describe('Validating', () => {

    // - Is Skyrim a game?
    test('check Skyrim is a game', async () => {
        document = await parse(`
            player Player1
                balance 100

            publisher Bethesda_Game_Studios

            genre RPG
	        description "Role Playing Game genre"

            game The_Elder_Scrolls_V_Skyrim_Special_Edition
                genres RPG
                publisher Bethesda_Game_Studios 
                price 3999
                release_date 28-08-2016
                versions version_id "1.6.1179" game_files "skyrim.exe" is_current true approved true
        `);
        const model = document.parseResult.value
        expect(model.games.some(g => g.name == "The_Elder_Scrolls_V_Skyrim_Special_Edition"))
        expect(
            checkDocumentValid(document) || document?.diagnostics?.map(diagnosticToString)?.join('\n')
        ).toHaveLength(0);
    });

    // - Has this review been flagged by a moderator? 
    test('check review is flagged', async () => {
        document = await parse(`
            player Player1
                balance 100

            publisher Bethesda_Game_Studios

            genre RPG
	            description "Role Playing Game genre"

            game The_Elder_Scrolls_V_Skyrim_Special_Edition
                genres RPG
                publisher Bethesda_Game_Studios 
                price 3999
                release_date 28-08-2016
                versions 
                    version_id "1.6.1179" game_files "skyrim.exe" is_current true approved true
                    version_id "1.5.123" game_files "skyrim.exe" is_current false approved true
                reviews
                    review content "this is a bad game"
                        is_flagged false
                        author "Player1"
                    review content "this is my favorite game of all time!!"
                        is_flagged false
                        author "Player2"
        `);
        const model = document.parseResult.value
        const player1Review = model.games
            .find(g => g.name == "The_Elder_Scrolls_V_Skyrim_Special_Edition")
            .reviews.find(r => r.author == "Player1")
        expect(!player1Review.is_flagged)
        expect(
            checkDocumentValid(document) || document?.diagnostics?.map(diagnosticToString)?.join('\n')
        ).toHaveLength(0);
    });

    // - Does the player have enough money to buy Skyrim?
    test('check review is flagged', async () => {
        document = await parse(`
            player Player1
                balance 100

            publisher Bethesda_Game_Studios

            game The_Elder_Scrolls_V_Skyrim_Special_Edition
                genres RPG
                publisher Bethesda_Game_Studios 
                price 3999
                release_date 28-08-2016
                versions 
                    version_id "1.6.1179" game_files "skyrim.exe" is_current true approved true
                    version_id "1.5.123" game_files "skyrim.exe" is_current false approved true
                reviews
                    review content "this is a bad game"
                        is_flagged false
                        author "Player1"
                    review content "this is my favorite game of all time!!"
                        is_flagged false
                        author "Player2"
        `);
        const model = document.parseResult.value
        const skyrim = model.games.find(g => g.name == "The_Elder_Scrolls_V_Skyrim_Special_Edition")
        const canPlayerAffordSkyrim = skyrim.price <= model.player.balance
        expect(!canPlayerAffordSkyrim)
        expect(
            checkDocumentValid(document) || document?.diagnostics?.map(diagnosticToString)?.join('\n')
        ).toHaveLength(0);
    });
});

function checkDocumentValid(document: LangiumDocument): string | undefined {
    return document.parseResult.parserErrors.length && s`
        Parser errors:
          ${document.parseResult.parserErrors.map(e => e.message).join('\n  ')}
    `
        || document.parseResult.value === undefined && `ParseResult is 'undefined'.`
        || !isPublisherModel(document.parseResult.value) && `Root AST object is a ${document.parseResult.value.$type}, expected a 'Model'.`
        || undefined;
}

function diagnosticToString(d: Diagnostic) {
    return `[${d.range.start.line}:${d.range.start.character}..${d.range.end.line}:${d.range.end.character}]: ${d.message}`;
}
