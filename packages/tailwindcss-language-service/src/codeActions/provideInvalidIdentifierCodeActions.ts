import { State } from '../util/state'
import {
  type CodeActionParams, CodeAction,
  CodeActionKind,
  Command,
} from 'vscode-languageserver'
import { CssConflictDiagnostic, InvalidIdentifierDiagnostic } from '../diagnostics/types'
import { joinWithAnd } from '../util/joinWithAnd'
import { removeRangesFromString } from '../util/removeRangesFromString'


export async function provideInvalidIdentifierCodeActions(
  _state: State,
  params: CodeActionParams,
  diagnostic: InvalidIdentifierDiagnostic
): Promise<CodeAction[]> {
	const actions: CodeAction[] = [{
		title: `Ignore '${diagnostic.chunk}' in this workspace`,
		kind: CodeActionKind.QuickFix,
		diagnostics: [diagnostic],
		command: Command.create(`Ignore '${diagnostic.chunk}' in this workspace`, 'tailwindCSS.addWordToWorkspaceFileFromServer', diagnostic.chunk)
	}];

	if (typeof diagnostic.suggestion == 'string') {
		actions.push({
			title: `Replace with '${diagnostic.suggestion}'`,
			kind: CodeActionKind.QuickFix,
			diagnostics: [diagnostic],
			isPreferred: true,
			edit: {
			  changes: {
				[params.textDocument.uri]: [
				  {
					range: diagnostic.range,
					newText: diagnostic.suggestion,
				  },
				],
			  },
			},
		})
	} else {
		// unimplemented.
	}

	return actions;
}
