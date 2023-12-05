import { State, Settings, DocumentClassName, Variant } from '../util/state'
import { CssConflictDiagnostic, DiagnosticKind, InvalidIdentifierDiagnostic } from './types'
import { findClassListsInDocument, getClassNamesInClassList } from '../util/find'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { DiagnosticSeverity, Range } from 'vscode-languageserver'

function createDiagnostic(data: {
		className: DocumentClassName,
		range: Range,
		chunk: string,
		message: string,
		suggestion?: string
		severity: 'info' | 'warning' | 'error' | 'ignore'
	}): InvalidIdentifierDiagnostic
{
	let severity: DiagnosticSeverity = 1;

	switch (data.severity) {
		case "info":
			severity = 3;
			break
		case "warning":
			severity = 2;
			break
		case "error":
			severity = 1;
			break
	}

	return({
		code: DiagnosticKind.InvalidIdentifier,
		severity,
		range: data.range,
		message: data.message,
		className: data.className,
		chunk: data.chunk,
		source: "TailwindCSS",
		data: {
			name: data.className.className
		},
		suggestion: data.suggestion,
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

function getMinimumSimilarity(str: string) {
	if (str.length < 5) {
		return 0.5
	} else {
		return 0.7
	}
}


function handleClass(data: {state: State, 
	settings: Settings,
	className: DocumentClassName,
	chunk: string,
	classes: {[key: string]: State['classList'][0] },
	noNumericClasses: {[key: string]: string[]},
	range: Range
	})
{
	if (data.chunk.indexOf('[') != -1 || data.classes[data.chunk] != undefined) {
		return null;
	}

	let nonNumericChunk = data.chunk.split('-');
	let nonNumericRemainder = nonNumericChunk.pop();
	const nonNumericValue = nonNumericChunk.join('-');

	if (data.noNumericClasses[data.chunk])
	{
		return createDiagnostic({
			className: data.className,
			range: data.range,
			chunk: data.chunk,
			message: `${data.chunk} requires an postfix. Choose between ${data.noNumericClasses[data.chunk].join(', -')}.`,
			severity: data.settings.tailwindCSS.lint.validateClasses,
		})
	}

	if (data.classes[nonNumericValue])
	{
		return createDiagnostic({
			className: data.className, 
			range: data.range, 
			chunk: data.chunk, 
			message: `${nonNumericValue} requires no postfix.`,
			suggestion: nonNumericValue,
			severity: data.settings.tailwindCSS.lint.validateClasses,
		})
	}

	if (nonNumericValue && data.noNumericClasses[nonNumericValue])
	{
		let closestSuggestion = {
			value: 0,
			text: ""
		};

		for (let i = 0; i < data.noNumericClasses[nonNumericValue].length; i++) {
			const e = data.noNumericClasses[nonNumericValue][i];
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
			return createDiagnostic({
				className: data.className, 
				range: data.range, 
				chunk: data.chunk, 
				message: `${data.chunk} is an invalid value. Did you mean ${nonNumericValue + '-' + closestSuggestion.text}?`,
				suggestion: nonNumericValue + '-' + closestSuggestion.text,
				severity: data.settings.tailwindCSS.lint.validateClasses,
			})
		}
		else
		{
			return createDiagnostic({
				className: data.className, 
				range: data.range, 
				chunk: data.chunk, 
				message: `${data.chunk} is an invalid value. Choose between ${data.noNumericClasses[nonNumericValue].join(', ')}.`,
				severity: data.settings.tailwindCSS.lint.validateClasses,
			})
		}
	}

	// get similar as suggestion
	let closestSuggestion = {
		value: 0,
		text: ""
	};

	let minimumSimilarity = getMinimumSimilarity(data.className.className)
	for (let i = 0; i < data.state.classList.length; i++) {
		const e = data.state.classList[i];
		const match = similarity(e[0], data.className.className);
		if (match >= minimumSimilarity && match > closestSuggestion.value) {
			closestSuggestion = {
				value: match,
				text: e[0]
			}
		}
	}

	if (closestSuggestion.text)
	{
		return createDiagnostic({
			className: data.className, 
			range: data.range, 
			chunk: data.chunk, 
			message: `${data.chunk} was not found in the registry. Did you mean ${closestSuggestion.text}?`, 
			severity: data.settings.tailwindCSS.lint.validateClasses,
			suggestion: closestSuggestion.text
		})
	}
	else if (data.settings.tailwindCSS.lint.onlyAllowTailwindCSS)
	{
		return createDiagnostic({
			className: data.className, 
			range: data.range, 
			chunk: data.chunk, 
			message: `${data.chunk} was not found in the registry.`,
			severity: data.settings.tailwindCSS.lint.validateClasses
		})
	}
	return null
}

function handleVariant(data: {
	state: State, 
	settings: Settings,
	className: DocumentClassName, 
	chunk: string, 
	variants: {[key: string]: Variant }, 
	range: Range
	})
{
	if (data.chunk.indexOf('[') != -1 || data.variants[data.chunk]) {		
		return null;
	}

	// get similar as suggestion
	let closestSuggestion = {
		value: 0,
		text: ""
	};
	let minimumSimilarity = getMinimumSimilarity(data.className.className)

	Object.keys(data.variants).forEach(key => {
		const variant = data.variants[key];
		const match = similarity(variant.name, data.chunk);
		if (match >= minimumSimilarity && match > closestSuggestion.value) {
			closestSuggestion = {
				value: match,
				text: variant.name
			}
		}
	})


	if (closestSuggestion.text)
	{
		return createDiagnostic({
			className: data.className, 
			range: data.range, 
			chunk: data.chunk, 
			message: `${data.chunk} is an invalid variant. Did you mean ${closestSuggestion.text}?`, 
			suggestion: closestSuggestion.text,
			severity: data.settings.tailwindCSS.lint.validateClasses
		})
	}
	else
	{
		return createDiagnostic({
			className: data.className, 
			range: data.range, 
			chunk: data.chunk, 
			message: `${data.chunk} is an invalid variant.`,
			severity: data.settings.tailwindCSS.lint.validateClasses
		});
	}

}

export async function getInvalidValueDiagnostics(
	state: State,
	document: TextDocument,
	settings: Settings
): Promise<InvalidIdentifierDiagnostic[]> {
	let severity = settings.tailwindCSS.lint.validateClasses
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

				if (!settings.tailwindCSS.ignoredCSS.find(x => x == chunk)) {
					if (index == splitted.length - 1)
					{
						items.push(handleClass({state, settings, className, chunk, classes, noNumericClasses, range}));
					}
					else 
					{
						items.push(handleVariant({state, settings, className, chunk, variants, range}));
					}
				}
				offset += chunk.length + 1;
			})
		});
	})

	return items.filter(Boolean);
}