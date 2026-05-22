import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node.js';
import type * as vscode from 'vscode';
import { commands, window } from 'vscode';
import * as path from 'node:path';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node.js';
import * as fs from 'fs/promises';

let client: LanguageClient;
let extensionTerminal: vscode.Terminal | undefined;


function getOrCreateTerminal(context: vscode.ExtensionContext): vscode.Terminal {
  if (!extensionTerminal) {
    extensionTerminal = window.createTerminal('My Extension');

    context.subscriptions.push(
      window.onDidCloseTerminal((terminal) => {
        if (terminal === extensionTerminal) {
          extensionTerminal = undefined;
        }
      })
    );
  }

  return extensionTerminal;
}
async function getCliOrDefault(editor: vscode.TextEditor): Promise<string> {
  const currentDir = path.dirname(editor.document.uri.fsPath);
  const cliPath = path.join(path.dirname(currentDir), 'publisher', 'packages', 'cli', 'bin', 'cli.js')
  const cliFound = (await fs.stat(cliPath)).isFile()
  return cliFound ? `node ${cliPath}` : "game"
}

// This function is called when the extension is activated.
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  client = await startLanguageClient(context);


  context.subscriptions.push(
    commands.registerCommand('publisher.pullButton', async () => {
      const editor = window.activeTextEditor;
      const cli = await getCliOrDefault(editor);
      const languageId = editor?.document.languageId;
      const fileName = path.parse(editor.document.uri.fsPath).name;
      const terminal = getOrCreateTerminal(context)
      // terminal.show();
      terminal.sendText(`${cli} pull ${languageId} ${fileName}`);

      window.showInformationMessage(`Pulling from db user ${fileName} type ${languageId}`);
    })
  );
  context.subscriptions.push(
    commands.registerCommand('publisher.pushButton', async () => {
      const editor = window.activeTextEditor;
      const cli = await getCliOrDefault(editor);
      const file = path.parse(editor.document.uri.fsPath).base;
      const terminal = getOrCreateTerminal(context)
      terminal.sendText(`${cli} push ${file}`);

      window.showInformationMessage(`Pushed file ${file}`);
    })
  );
}

// This function is called when the extension is deactivated.
export function deactivate(): Thenable<void> | undefined {
  if (client) {
    return client.stop();
  }
  return undefined;
}

async function startLanguageClient(context: vscode.ExtensionContext): Promise<LanguageClient> {
  const serverModule = context.asAbsolutePath(path.join('out', 'language', 'main.cjs'));
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging.
  // By setting `process.env.DEBUG_BREAK` to a truthy value, the language server will wait until a debugger is attached.
  const debugOptions = { execArgv: ['--nolazy', `--inspect${process.env.DEBUG_BREAK ? '-brk' : ''}=${process.env.DEBUG_SOCKET || '6009'}`] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: '*', language: 'publisher' },
      { scheme: '*', language: 'player' },
      { scheme: '*', language: 'administrator' }
    ]
  };

  // Create the language client and start the client.
  const client = new LanguageClient(
    'shared',
    'Shared',
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  await client.start();
  return client;
}
