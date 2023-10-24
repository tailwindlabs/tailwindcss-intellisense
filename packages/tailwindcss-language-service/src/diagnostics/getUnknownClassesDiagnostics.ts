import { joinWithAnd } from '../util/joinWithAnd'
import { State, Settings, DocumentClassName, Variant } from '../util/state'
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

function generateHashMaps(state: State)
{
	const classes: {[key: string]: State['classList'][0] } = {};
	const noNumericClasses: {[key: string]: string[]} = {};
	const variants: {[key: string]: Variant } = {};

	state.classList.forEach((classItem) => {
		classes[classItem[0]] = classItem;
		const splittedClass = classItem[0].split('-');
		if (splittedClass.length != 1) {
			const lastToken = splittedClass.pop();
			const joinedName = splittedClass.join('-')
			
			if (Array.isArray(noNumericClasses[joinedName]))
			{
				noNumericClasses[joinedName].push(lastToken);
			} else {
				noNumericClasses[joinedName] = [lastToken];
			}
		}
	})

	state.variants.forEach((variant) => {
		if (variant.isArbitrary) {
			variant.values.forEach(value => {
				variants[`${variant.name}-${value}`] = variant;
			})
		} else {
			variants[variant.name] = variant;
		}
	})

	return {classes, variants, noNumericClasses};
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

function handleClass(state: State, 
	className: DocumentClassName,
	chunk: string,
	classes: {[key: string]: State['classList'][0] },
	noNumericClasses: {[key: string]: string[]},
	)
{
	if (chunk.indexOf('[') != -1 || classes[chunk] != undefined) {
		return null;
	}

	let nonNumericChunk = chunk.split('-');
	let nonNumericRemainder = nonNumericChunk.pop();
	const nonNumericValue = nonNumericChunk.join('-');

	if (noNumericClasses[chunk])
	{
		return({
			code: DiagnosticKind.InvalidIdentifier,
			severity: 3,
			range: className.range,
			message: `${chunk} requires an postfix. Choose between ${noNumericClasses[chunk].join(', -')}.`,
			className,
			otherClassNames: null
		})			
	}

	if (classes[nonNumericValue])
	{
		return({
			code: DiagnosticKind.InvalidIdentifier,
			severity: 3,
			range: className.range,
			message: `${chunk} requires no postfix.`,
			className,
			otherClassNames: null
		})			
	}

	if (nonNumericValue && noNumericClasses[nonNumericValue])
	{
		let closestSuggestion = {
			value: 0,
			text: ""
		};

		debugger;

		for (let i = 0; i < noNumericClasses[nonNumericValue].length; i++) {
			const e = noNumericClasses[nonNumericValue][i];
			const match = similarity(e, nonNumericRemainder);
			if (match > 0.5 && match > closestSuggestion.value) {
				closestSuggestion = {
					value: match,
					text: e
				}
			}
		}

		if (closestSuggestion.text)
		{
			return({
				code: DiagnosticKind.InvalidIdentifier,
				severity: 3,
				range: className.range,
				message: `${chunk} is an invalid value. Did you mean ${nonNumericValue + '-' + closestSuggestion.text}? (${closestSuggestion.value})`,
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
				message: `${chunk} is an invalid value. Choose between ${noNumericClasses[nonNumericValue].join(', ')}.`,
				className,
				otherClassNames: null
			})
		}
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

function handleVariant(state: State, className: DocumentClassName, chunk: string, variants: {[key: string]: Variant })
{
	if (chunk.indexOf('[') != -1 || variants[chunk]) {		
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

	const { classes, variants, noNumericClasses} = generateHashMaps(state);

	let diagnostics: CssConflictDiagnostic[] = [];
	const classLists = await findClassListsInDocument(state, document)
	const items = [];

	classLists.forEach((classList) => {
		const classNames = getClassNamesInClassList(classList, state.blocklist)

		let offset = 0;
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
					items.push(handleClass(state, className, chunk, classes, noNumericClasses));
				}
				// variant
				else 
				{
					items.push(handleVariant(state, className, chunk, variants));
				}
			})
		});
	})

	return items.filter(Boolean);
}