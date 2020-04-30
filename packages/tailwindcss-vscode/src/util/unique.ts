export function unique<T>(arr: Array<T>): Array<T> {
	return arr.filter((value, index, self) => self.indexOf(value) === index)
}
