const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const appRoot = path.join(__dirname, "..");
const baseline = "3e90d434289af73a0a31518789a0fd7b819f3e59";
const additions = {
  "scripts/release_publish.cmd": "call npm run invoice:prepare\nif errorlevel 1 exit /b 1\n",
  ".gitignore":
    "\n# Local invoice runtime, generated tests and user data\nruntime/\ninvoice/vendor/\ninvoice/tools/\n**/__pycache__/\ninvoice/data/\ntests/desktop-data/\ntests/pdf-samples/\ntests/*.png\n",
  "main.js": 'require("./invoice-ipc");\n',
  "preload.js":
    'contextBridge.exposeInMainWorld("invoiceAPI", {\n  request: (input) => ipcRenderer.invoke("invoice:request", input),\n});\n',
  "renderer/index.html": [
    '  <link rel="stylesheet" href="./css/50_invoices.css" />\n',
    '<script type="module" src="./app/invoices.js"></script>\n',
  ],
};
function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: appRoot,
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  });
}
function originalFiles() {
  const entries = git(["ls-tree", "-rz", "--full-tree", baseline])
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const [header, filename] = entry.split("\t");
      const [, type, object] = header.split(" ");
      assert.equal(type, "blob", filename);
      return { filename, object };
    });
  const output = git(["cat-file", "--batch"], {
    input: entries.map((entry) => entry.object).join("\n") + "\n",
  });
  let offset = 0;
  return new Map(
    entries.map((entry) => {
      const end = output.indexOf(10, offset);
      const [object, type, length] = output
        .subarray(offset, end)
        .toString("utf8")
        .split(" ");
      assert.equal(object, entry.object);
      assert.equal(type, "blob");
      offset = end + 1;
      const contents = output.subarray(offset, offset + Number(length));
      offset += Number(length) + 1;
      return [entry.filename, contents];
    }),
  );
}
const original = originalFiles();
function normalizeCheckout(contents) {
  const text = contents.toString("utf8");
  // Windows checkouts can change text line endings. Binary files remain exact.
  if (contents.includes(0) || !Buffer.from(text, "utf8").equals(contents)) return contents;
  return Buffer.from(text.replace(/\r\n/g, "\n"), "utf8");
}
test("Official validation resources preserve their manifest hashes in Git", () => {
  const crypto = require("node:crypto");
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, "invoice/validation/manifest.json")));
  for (const [relative, expected] of Object.entries(manifest.files)) {
    const filename = "invoice/validation/" + relative;
    const attribute = git(["check-attr", "text", "--", filename]).toString().trim();
    assert.ok(attribute.endsWith(": text: unset"), filename);
    const staged = git(["show", ":" + filename]);
    assert.equal(crypto.createHash("sha256").update(staged).digest("hex"), expected, filename);
  }
});
test("Original 1.7.3 files match the upstream Git commit except documented additive hooks", () => {
  let checked = 0;
  for (const [filename, before] of original) {
    if (["package.json", "package-lock.json"].includes(filename)) continue;
    const after = fs.readFileSync(path.join(appRoot, filename));
    if (additions[filename]) {
      let text = after.toString("utf8").replace(/\r\n/g, "\n");
      for (const addition of [].concat(additions[filename])) {
        assert.ok(
          text.includes(addition),
          "Missing integration hook: " + filename,
        );
        text = text.replace(addition, "");
      }
      const expected = before.toString("utf8").replace(/\r\n/g, "\n");
      assert.equal(
        filename === ".gitignore" ? text.trimEnd() : text,
        filename === ".gitignore" ? expected.trimEnd() : expected,
        filename,
      );
    } else assert.equal(Buffer.compare(normalizeCheckout(before), normalizeCheckout(after)), 0, filename);
    checked++;
  }
  assert.ok(checked > 5000);
  console.log(`Compared ${checked} original files against ${baseline}`);
});
test("Existing dependency versions, scripts and update configuration are preserved", () => {
  const expected = JSON.parse(original.get("package.json"));
  expected.version = "1.7.4";
  expected.scripts.test = "node --test tests/*.test.cjs";
  expected.scripts["invoice:prepare"] = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-invoice.ps1";
  for (const hook of ["prestart", "prepack", "predist"]) expected.scripts[hook] = "npm run invoice:prepare";
  expected.build.files.push("invoice-ipc.js");
  expected.build.extraResources = [
    {
      from: "invoice",
      to: "invoice",
      filter: ["**/*", "!test_*.py", "!__pycache__/**/*"],
    },
    { from: "runtime/python", to: "python" },
  ];
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"))),
    expected,
  );
  const lock = JSON.parse(original.get("package-lock.json"));
  lock.version = "1.7.4";
  lock.packages[""].version = "1.7.4";
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(appRoot, "package-lock.json"))),
    lock,
  );
});
const packaged = path.join(appRoot, "dist/win-unpacked/resources/app");
const archive = path.join(appRoot, "dist/win-unpacked/resources/app.asar");
test(
  "Local Windows package contains the audited source and current integration",
  { skip: !fs.existsSync(packaged) && !fs.existsSync(archive) },
  () => {
    const files = [...original.keys()].filter(
      (filename) =>
        ["main.js", "preload.js", "package.json"].includes(filename) ||
        filename.startsWith("renderer/") ||
        filename.startsWith("background/"),
    );
    files.push(
      "invoice-ipc.js",
      "renderer/app/invoices.js",
      "renderer/app/invoice-ui-pl.js",
      "renderer/css/50_invoices.css",
    );
    for (const filename of files)
      assert.equal(
        Buffer.compare(
          normalizeCheckout(fs.readFileSync(path.join(appRoot, filename))),
          normalizeCheckout(fs.existsSync(archive)
            ? require("@electron/asar").extractFile(archive, filename)
            : fs.readFileSync(path.join(packaged, filename))),
        ),
        0,
        filename,
      );
  },
);
