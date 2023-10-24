import { joinWithAnd } from '../util/joinWithAnd'
import { State, Settings, DocumentClassName } from '../util/state'
import { CssConflictDiagnostic, DiagnosticKind } from './types'
import { findClassListsInDocument, getClassNamesInClassList } from '../util/find'
import { getClassNameDecls } from '../util/getClassNameDecls'
import { getClassNameMeta } from '../util/getClassNameMeta'
import { equal } from '../util/array'
import * as jit from '../util/jit'
import type { AtRule, Node, Rule } from 'postcss'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { Position, Range } from 'vscode-languageserver'

function isAtRule(node: Node): node is AtRule {
	return node.type === 'atrule'
  }

function isKeyframes(rule: Rule): boolean {
	let parent = rule.parent
	if (!parent) {
	  return false
	}
	if (isAtRule(parent) && parent.name === 'keyframes') {
	  return true
	}
	return false
}

function similarity(s1: string, s2: string) {
	if (!s1 || !s2)
		return 0;

	var longer = s1;
	var shorter = s2;
	if (s1.length < s2.length) {
	  longer = s2;
	  shorter = s1;
	}
	var longerLength = longer.length;
	if (longerLength == 0) {
	  return 1.0;
	}
	return (longerLength - editDistance(longer, shorter)) / longerLength;
  }

function editDistance(s1: string, s2: string) {
	s1 = s1.toLowerCase();
	s2 = s2.toLowerCase();
  
	var costs = new Array();
	for (var i = 0; i <= s1.length; i++) {
	  var lastValue = i;
	  for (var j = 0; j <= s2.length; j++) {
		if (i == 0)
		  costs[j] = j;
		else {
		  if (j > 0) {
			var newValue = costs[j - 1];
			if (s1.charAt(i - 1) != s2.charAt(j - 1))
			  newValue = Math.min(Math.min(newValue, lastValue),
				costs[j]) + 1;
			costs[j - 1] = lastValue;
			lastValue = newValue;
		  }
		}
	  }
	  if (i > 0)
		costs[s2.length] = lastValue;
	}
	return costs[s2.length];
}

function getRuleProperties(rule: Rule): string[] {
	let properties: string[] = []
	rule.walkDecls(({ prop }) => {
	  properties.push(prop)
	})
	// if (properties.findIndex((p) => !isCustomProperty(p)) > -1) {
	//   properties = properties.filter((p) => !isCustomProperty(p))
	// }
	return properties
  }

function handleClass(state: State, className: DocumentClassName, chunk: string)
{
	if (chunk.indexOf('[') != -1 || state.classList.find(x => x[0] == chunk)) {
		return null;
	}
	// get similar as suggestion
	let closestSuggestion = {
		value: 0,
		text: ""
	};
	for (let i = 0; i < state.classList.length; i++) {
		const e = state.classList[i];
		const match = similarity(e[0], className.className);
		if (match > 0.5 && match > closestSuggestion.value) {
			closestSuggestion = {
				value: match,
				text: e[0]
			}
		}
	}

	if (closestSuggestion.text)
	{
		return({
			code: DiagnosticKind.InvalidIdentifier,
			severity: 3,
			range: className.range,
			message: `${chunk} was not found in the registry. Did you mean ${closestSuggestion.text} (${closestSuggestion.value})?`,
			className,
			otherClassNames: null
		})
	}
	else
	{
		return({
			code: DiagnosticKind.InvalidIdentifier,
			severity: 3,
			range: className.range,
			message: `${chunk} was not found in the registry.`,
			className,
			otherClassNames: null
		})
	}
}

function handleVariant(state: State, className: DocumentClassName, chunk: string)
{
	if (chunk.indexOf('[') != -1 || state.variants.find(x => x.name == chunk)) {		
		return null;
	}

	if (chunk.indexOf('-') != -1 &&
		state.variants.find(x => {
			return x.isArbitrary ? x.values.find(value => `${x.name}-${value}` == chunk) : undefined
		})
		) {
			return null;
	}

	// get similar as suggestion
	let closestSuggestion = {
		value: 0,
		text: ""
	};
	for (let i = 0; i < state.variants.length; i++) {
		const e = state.variants[i];
		const match = similarity(e[0], chunk);
		if (match > 0.5 && match > closestSuggestion.value) {
			closestSuggestion = {
				value: match,
				text: e[0]
			}
		}
	}

	if (closestSuggestion.text)
	{
		return{
			code: DiagnosticKind.InvalidIdentifier,
			severity: 3,
			range: className.range,
			message: `${chunk} is an invalid variant. Did you mean ${closestSuggestion.text} (${closestSuggestion.value})?`,
			className,
			otherClassNames: null
		}
	}
	else
	{
		return {
			code: DiagnosticKind.InvalidIdentifier,
			severity: 3,
			range: className.range,
			message: `${chunk} is an invalid variant.`,
			className,
			otherClassNames: null
		}
	}

}

export async function getUnknownClassesDiagnostics(
	state: State,
	document: TextDocument,
	settings: Settings
): Promise<CssConflictDiagnostic[]> {
	// let severity = settings.tailwindCSS.lint
	// if (severity === 'ignore') return [];

	let diagnostics: CssConflictDiagnostic[] = [];
	const classLists = await findClassListsInDocument(state, document)
	const items = [];

	classLists.forEach((classList) => {
		const classNames = getClassNamesInClassList(classList, state.blocklist)

		classNames.forEach((className, index) => {
			const splitted = className.className.split(state.separator);

			splitted.forEach((chunk, index) => {
				if (chunk == 'group-only')
				{
					debugger;
				}

				// class
				if (index == splitted.length - 1)
				{
					items.push(handleClass(state, className, chunk ));
				}
				// variant
				else 
				{
					items.push(handleVariant(state, className, chunk));

				}
			})
		});
	})

	return items.filter(Boolean);
}