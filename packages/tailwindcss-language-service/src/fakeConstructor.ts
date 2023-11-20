const fs = require("fs");

let logCounter = 0;

export function log2(msg: string)  {
  if (logCounter == 0) {
    fs.unlink("tailwind.txt", () => { });
    logCounter += 1;
  }
  let content = `\n${new Date().toString()}:\n\t msg:[${msg}]\n`;
    fs.appendFile("tailwind.txt", content, (_err) => {
  });
}

export function trimClass(className: string): string {
  let parts = className.split(" ")
  let last = parts[parts.length - 1]
  if (last) {
    if (last.trim().length != 0) {
      if (last.includes(":")) {
        const last2 = last.split(":");
        let newLast = last2[last2.length - 1];
        if (newLast) {
          return newLast
        }
        return last
      }
      return last
    }
  }
  return ""
};
