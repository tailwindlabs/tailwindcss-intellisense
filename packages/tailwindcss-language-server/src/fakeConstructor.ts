const fs = require("fs");

let logCounter = 0;

export function log2(msg: string)  {
  if (logCounter == 0) {
    fs.unlink("tailwind.txt", () => { });
    logCounter += 1;
  }
  let content = `\n${new Date().toString()}:\n\t msg:[\n${msg}\n]\n`;
    fs.appendFile("tailwind.txt", content, (_err) => {
  });
}
