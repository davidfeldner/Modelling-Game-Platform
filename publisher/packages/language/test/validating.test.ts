import { beforeAll, describe, expect, test } from "vitest";
import { EmptyFileSystem, type LangiumDocument } from "langium";
import { expandToString as s } from "langium/generate";
import { parseHelper } from "langium/test";
import type { Diagnostic } from "vscode-languageserver-types";
import type { PublisherModel } from "publisher-language";
import { createSharedServices, isPublisherModel } from "publisher-language";

let services: ReturnType<typeof createSharedServices>;
let parse:    ReturnType<typeof parseHelper<PublisherModel>>;
let document: LangiumDocument<PublisherModel> | undefined;

beforeAll(async () => {
    services = createSharedServices(EmptyFileSystem);
    const doParse = parseHelper<PublisherModel>(services.Publisher);
    parse = (input: string) => doParse(input, { validation: true });

    // activate the following if your linking test requires elements from a built-in library, for example
    // await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
});

describe('Validating', () => {

    test('check no errors', async () => {
        document = await parse(`
            publisher ExamplePublisher balance 1000
        `);

        expect(
            // here we first check for validity of the parsed document object by means of the reusable function
            //  'checkDocumentValid()' to sort out (critical) typos first,
            // and then evaluate the diagnostics by converting them into human readable strings;
            // note that 'toHaveLength()' works for arrays and strings alike ;-)
            checkDocumentValid(document) || document?.diagnostics?.map(diagnosticToString)?.join('\n')
        ).toHaveLength(0);
    });

    // - Is Skyrim a game?
    test('check Skyrim is a game', async () => {
        document = await parse(`
            publisher Bethesda_Game_Studios
            balance 10000

            genre RPG
	        description "Role Playing Game genre"

            game The_Elder_Scrolls_V_Skyrim_Special_Edition
                genres RPG
                publisher Bethesda_Game_Studios 
                price 3999
                release_date 28-08-2016
                state "approved"
                versions version_id "1.6.1179" game_files "skyrim.exe" is_current true approved true
        `);
        
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
