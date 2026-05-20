import { beforeAll, describe, expect, test } from "vitest";
import { EmptyFileSystem, type LangiumDocument } from "langium";
import { expandToString as s } from "langium/generate";
import { parseHelper } from "langium/test";
import type { Diagnostic } from "vscode-languageserver-types";
import type { AdministratorModel } from "publisher-language";
import { createSharedServices, isPublisherModel } from "publisher-language";

let services: ReturnType<typeof createSharedServices>;
let parse:    ReturnType<typeof parseHelper<AdministratorModel>>;
let document: LangiumDocument<AdministratorModel> | undefined;

beforeAll(async () => {
    services = createSharedServices(EmptyFileSystem);
    const doParse = parseHelper<AdministratorModel>(services.Publisher);
    parse = (input: string) => doParse(input, { validation: true });

    // activate the following if your linking test requires elements from a built-in library, for example
    // await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
});

describe('Validating', () => {

    // - Has this review been flagged by a moderator? 
    test('check review is flagged', async () => {
        document = await parse(`
            administrator Admin

            player Player1
                balance 100

            publisher Bethesda_Game_Studios
                balance 100000

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

    // - Has the game approval request been approved by an administrator?
    test('check game approval request has been handled', async () => {
        document = await parse(`
            administrator Admin

            player Player1
                balance 100

            publisher Bethesda_Game_Studios
                balance 100000

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
            
                approval request game The_Elder_Scrolls_V_Skyrim_Special_Edition
                    version "1.6.1179"
                    status APPROVED
        `);
        const model = document.parseResult.value
        const skyrim = model.games.find(g => g.name == "The_Elder_Scrolls_V_Skyrim_Special_Edition")
        const request = model.requests.find(r => r.game.ref.name == skyrim.name)
            
        expect(request.status == "APPROVED")
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
