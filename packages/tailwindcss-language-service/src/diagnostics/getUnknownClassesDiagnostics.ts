import { State, Settings, DocumentClassName, Variant } from '../util/state'
import { CssConflictDiagnostic, DiagnosticKind, InvalidIdentifierDiagnostic } from './types'
import { findClassListsInDocument, getClassNamesInClassList } from '../util/find'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { Range } from 'vscode-languageserver'

function createDiagnostic(className: DocumentClassName, range: Range, message: string, suggestion?: string): InvalidIdentifierDiagnostic
{
	return({
		code: DiagnosticKind.InvalidIdentifier,
		severity: 3,
		range: range,
		message,
		className,
		suggestion,
		otherClassNames: null
	})
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

function handleClass(state: State, 
	className: DocumentClassName,
	chunk: string,
	classes: {[key: string]: State['classList'][0] },
	noNumericClasses: {[key: string]: string[]},
	range: Range
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
		return createDiagnostic(className, range, `${chunk} requires an postfix. Choose between ${noNumericClasses[chunk].join(', -')}.`)
	}

	if (classes[nonNumericValue])
	{
		return createDiagnostic(className, range, `${chunk} requires no postfix.`)
	}

	if (nonNumericValue && noNumericClasses[nonNumericValue])
	{
		let closestSuggestion = {
			value: 0,
			text: ""
		};

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
			return createDiagnostic(className, range, `${chunk} is an invalid value. Did you mean ${nonNumericValue + '-' + closestSuggestion.text}? (${closestSuggestion.value})`, nonNumericValue + '-' + closestSuggestion.text)
		}
		else
		{
			return createDiagnostic(className, range, `${chunk} is an invalid value. Choose between ${noNumericClasses[nonNumericValue].join(', ')}.`)
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
		return createDiagnostic(className, range, `${chunk} was not found in the registry. Did you mean ${closestSuggestion.text} (${closestSuggestion.value})?`, closestSuggestion.text)
	}
	else
	{
		return createDiagnostic(className, range, `${chunk} was not found in the registry.`)
	}
}

function handleVariant(state: State, className: DocumentClassName, chunk: string, variants: {[key: string]: Variant }, range: Range)
{
	if (chunk.indexOf('[') != -1 || variants[chunk]) {		
		return null;
	}

	// get similar as suggestion
	let closestSuggestion = {
		value: 0,
		text: ""
	};

	Object.keys(variants).forEach(key => {
		const variant = variants[key];
		const match = similarity(variant.name, chunk);
		if (match >= 0.5 && match > closestSuggestion.value) {
			closestSuggestion = {
				value: match,
				text: variant.name
			}
		}
	})


	if (closestSuggestion.text)
	{
		return createDiagnostic(className, range,  `${chunk} is an invalid variant. Did you mean ${closestSuggestion.text} (${closestSuggestion.value})?`, closestSuggestion.text)
	}
	else
	{
		return createDiagnostic(className, range, `${chunk} is an invalid variant.`);
	}

}

export async function getUnknownClassesDiagnostics(
	state: State,
	document: TextDocument,
	settings: Settings
): Promise<InvalidIdentifierDiagnostic[]> {
	let severity = settings.tailwindCSS.lint.invalidClass
	if (severity === 'ignore') return [];
	
	const items = [];
	const { classes, variants, noNumericClasses} = generateHashMaps(state);

	const classLists = await findClassListsInDocument(state, document)
	classLists.forEach((classList) => {
		const classNames = getClassNamesInClassList(classList, state.blocklist)
		classNames.forEach((className, index) => {
			const splitted = className.className.split(state.separator);

			let offset = 0;
			splitted.forEach((chunk, index) => {

				const range: Range = {start: {
					line: className.range.start.line,
					character: className.range.start.character + offset,
				}, end: {
					line: className.range.start.line,
					character: className.range.start.character + offset + chunk.length,
				}}

				if (index == splitted.length - 1)
				{
					items.push(handleClass(state, className, chunk, classes, noNumericClasses, range));
				}
				else 
				{
					items.push(handleVariant(state, className, chunk, variants, range));
				}

				offset += chunk.length + 1;
			})
		});
	})

	return items.filter(Boolean);
}