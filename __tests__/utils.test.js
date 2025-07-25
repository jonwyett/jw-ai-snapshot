// __tests__/utils.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  sanitizeLabel,
  padNumber,
  getNextSnapshotIndex,
  loadIgnoreList,
  isIgnored,
  listFilesRecursively
} = require('../snapshot.js');

describe('sanitizeLabel', () => {
  test('lowercases and replaces spaces', () => {
    expect(sanitizeLabel('Hello World')).toBe('hello_world');
  });
  test('strips punctuation', () => {
    expect(sanitizeLabel('Test! @Label#')).toBe('test_label');
  });
  test('trims and collapses spaces', () => {
    expect(sanitizeLabel('  multiple   spaces  ')).toBe('multiple_spaces');
  });
});

describe('padNumber', () => {
  test('pads with zeros', () => {
    expect(padNumber(5, 3)).toBe('005');
    expect(padNumber(123, 5)).toBe('00123');
  });
  test('works with numbers longer than width', () => {
    expect(padNumber(123456, 3)).toBe('123456');
  });
});

describe('getNextSnapshotIndex', () => {
  let tempDir;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
  });
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  test('returns 1 if snapshot directory does not exist', () => {
    expect(getNextSnapshotIndex(path.join(tempDir, 'nope'))).toBe(1);
  });
  test('returns max+1 based on existing folders', () => {
    const root = path.join(tempDir, 'root');
    fs.mkdirSync(root);
    fs.mkdirSync(path.join(root, '0001_test'));
    fs.mkdirSync(path.join(root, '0003_other'));
    fs.mkdirSync(path.join(root, '0002_foo'));
    expect(getNextSnapshotIndex(root)).toBe(4);
  });
});

describe('loadIgnoreList', () => {
  let projectDir;
  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
  });
  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });
  test('always contains "__snapshots__" even if no file', () => {
    const ignoreSet = loadIgnoreList(projectDir);
    expect(ignoreSet.has('__snapshots__')).toBe(true);
  });
  test('parses patterns correctly', () => {
    fs.writeFileSync(path.join(projectDir, '.snapshotignore'), 'node_modules\n.env\n');
    const ignoreSet = loadIgnoreList(projectDir);
    expect(ignoreSet.has('node_modules')).toBe(true);
    expect(ignoreSet.has('.env')).toBe(true);
    // plus the built-in '__snapshots__'
    expect(ignoreSet.size).toBe(3);
  });
});

describe('isIgnored', () => {
  const ignoreSet = new Set(['foo', 'bar/baz']);
  test('matches exact pattern', () => {
    expect(isIgnored('foo', ignoreSet)).toBe(true);
  });
  test('matches nested paths', () => {
    expect(isIgnored('bar/baz/file.txt', ignoreSet)).toBe(true);
  });
  test('does not match unrelated paths', () => {
    expect(isIgnored('other/file.txt', ignoreSet)).toBe(false);
  });
});

describe('listFilesRecursively', () => {
  let root;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
    fs.mkdirSync(path.join(root, 'dir1'));
    fs.writeFileSync(path.join(root, 'dir1', 'file1.txt'), 'x');
    fs.writeFileSync(path.join(root, 'file2.txt'), 'y');
    fs.mkdirSync(path.join(root, '__snapshots__'));
    fs.writeFileSync(path.join(root, '__snapshots__', 'ignored.txt'), 'z');
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });
  test('lists project files and skips __snapshots__', () => {
    const files = listFilesRecursively(root, root, new Set()).sort();
    expect(files).toEqual(['dir1/file1.txt', 'file2.txt'].sort());
  });
});
