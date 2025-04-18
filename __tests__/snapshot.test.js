const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CLI = path.resolve(__dirname, '../snapshot.js');

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
}

describe('snapshot.js', () => {
  let projectDir;

  beforeEach(() => {
    projectDir = mktemp();

    // Copy the CLI into our temp project
    fs.copyFileSync(CLI, path.join(projectDir, 'snapshot.js'));

    // Create a couple of test files
    fs.writeFileSync(path.join(projectDir, 'a.txt'), 'lineA1\nlineA2\n');
    fs.writeFileSync(path.join(projectDir, 'b.txt'), 'lineB1\n');

    // Create a snapshotignore that ignores 'ignored.txt'
    fs.writeFileSync(
      path.join(projectDir, '.snapshotignore'),
      'ignored.txt\n'
    );

    // Create a file we expect to be ignored
    fs.writeFileSync(path.join(projectDir, 'ignored.txt'), 'IGNORE');
  });

  afterEach(() => {
    // Clean up
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  test('creates a snapshot folder and log entry', () => {
    execSync(`node snapshot.js "initial state"`, { cwd: projectDir });
    const snaps = fs.readdirSync(path.join(projectDir, '__snapshots__'));
    expect(snaps).toEqual(
      expect.arrayContaining([expect.stringMatching(/^0001_initial_state$/), 'snapshot.log'])
    );

    const snapContents = fs.readdirSync(path.join(projectDir, '__snapshots__/0001_initial_state'));
    expect(snapContents).toEqual(expect.arrayContaining(['a.txt','b.txt']));
    expect(snapContents).not.toContain('ignored.txt');
  });

  test('diff shows added, removed, and modified', () => {
    execSync(`node snapshot.js "first"`, { cwd: projectDir });

    fs.writeFileSync(path.join(projectDir, 'a.txt'), 'lineA1\nLINEA2MODIFIED\nlineA3\n');
    fs.rmSync(path.join(projectDir, 'b.txt'));
    fs.writeFileSync(path.join(projectDir, 'c.txt'), 'newC\n');

    execSync(`node snapshot.js 0001 --diff`, { cwd: projectDir });
    const diffJson = path.join(projectDir, '__snapshots__/diff_0001_to_current.json');
    expect(fs.existsSync(diffJson)).toBe(true);

    const diff = JSON.parse(fs.readFileSync(diffJson, 'utf8'));
    const statuses = diff.files.reduce((map, f) => {
      map[f.file] = f.status;
      return map;
    }, {});

    expect(statuses['a.txt']).toBe('modified');
    expect(statuses['b.txt']).toBe('removed');
    expect(statuses['c.txt']).toBe('added');
  });

  test('prompt file is generated with JSON diff inside', () => {
    // first create a snapshot so index 0001 exists
    execSync(`node snapshot.js "first"`, { cwd: projectDir });

    execSync(`node snapshot.js 0001 --prompt`, { cwd: projectDir });
    const promptFile = path.join(projectDir, '__snapshots__/prompt_0001_restore.txt');
    expect(fs.existsSync(promptFile)).toBe(true);

    const content = fs.readFileSync(promptFile, 'utf8');
    expect(content).toMatch(/Snapshot Regression Summary: 0001_first/);
    expect(content).toMatch(/"files": \[/);
  });

  test('restore brings back deleted files and prunes extraneous', () => {
    execSync(`node snapshot.js "base"`, { cwd: projectDir });

    fs.rmSync(path.join(projectDir, 'a.txt'));
    fs.writeFileSync(path.join(projectDir, 'd.txt'), 'temp');

    execSync(`node snapshot.js 0001 --restore`, { cwd: projectDir });

    expect(fs.existsSync(path.join(projectDir, 'a.txt'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'd.txt'))).toBe(false);
  });

  test('--dry-run logs but does not change files', () => {
    execSync(`node snapshot.js "drytest"`, { cwd: projectDir });

    // Mutate: remove b.txt, add e.txt
    fs.rmSync(path.join(projectDir, 'b.txt'));
    fs.writeFileSync(path.join(projectDir, 'e.txt'), 'temp');

    const output = execSync(`node snapshot.js 0001 --restore --dry-run`, {
      cwd: projectDir,
      encoding: 'utf8'
    });

    // Now only b.txt was missing, so it should be the one "restored"
    expect(output).toMatch(/Would restore: b\.txt/);
    expect(output).toMatch(/Would delete: e\.txt/);

    // Confirm no actual file changes
    // a.txt should still exist, b.txt still absent, e.txt still present
    expect(fs.existsSync(path.join(projectDir, 'a.txt'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'b.txt'))).toBe(false);
    expect(fs.existsSync(path.join(projectDir, 'e.txt'))).toBe(true);
  });
});
