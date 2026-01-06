import * as path from "node:path";
import * as fs from "node:fs";
import Mocha from "mocha";

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
    timeout: 60000,
  });

  const files = fs.readdirSync(__dirname);
  files.forEach((f) => {
    if (f.endsWith(".test.js")) {
      mocha.addFile(path.resolve(__dirname, f));
    }
  });

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed.`));
        return;
      }
      resolve();
    });
  });
}
