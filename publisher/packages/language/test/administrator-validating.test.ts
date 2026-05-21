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
    const doParse = parseHelper<AdministratorModel>(services.Administrator);
    parse = (input: string) => doParse(input, { validation: true });

    // activate the following if your linking test requires elements from a built-in library, for example
    // await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
});

describe('Validating', () => {

    // - Has this review been flagged by a moderator? 
    test('check review is flagged', async () => {
        document = await parse(`
            administrator Admin1

            publisher Publisher1
	            balance 1135

            genre Adventure
                description "Adventure is fun"

            game ExampleGame
                genres Adventure
                publisher Publisher1
                price 50
                release_date 01-01-2024
                versions version_id "1.0" game_files "game1.exe" is_current true approved true
                reviews
                    review content "Great game!"
                    author "Player1"
                    is_flagged false,
                    review content "Awful game!"
                    author "Player2"
                    is_flagged false
        `);
        const model = document.parseResult.value;
        const player1Review = model.games
            .find(g => g.name == "ExampleGame")
            .reviews.find(r => r.author == "Player1")
        expect(!player1Review.is_flagged);
        
    });

    // - Has the game approval request been approved by an administrator?
    test('check game approval request has been handled', async () => {
        document = await parse(`
            administrator Admin1

            publisher Publisher1
	            balance 1135

            genre Adventure
                description "Adventure is fun"

            game ExampleGame
                genres Adventure
                publisher Publisher1
                price 50
                release_date 01-01-2024
                versions 
                    version_id "1.1" game_files "game1.exe" is_current true approved false
                    version_id "1.0" game_files "game1.exe" is_current false approved true
                reviews
                    review content "Great game!"
                    author "Player1"
                    is_flagged false,
                    review content "Awful game!"
                    author "Player2"
                    is_flagged false
            
            approval request game ExampleGame
                version "1.6.1179"
                status PENDING
        `);
        const model = document.parseResult.value;
        const request = model.requests.find(r => r.game.ref.name == "ExampleGame");
            
        expect(request.status != "APPROVED");
        
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
