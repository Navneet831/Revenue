const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function getCommits() {
    try {
        const log = execSync('git log --oneline --no-pager').toString().trim();
        return log.split('\n').map((line, index) => {
            const parts = line.split(' ');
            const hash = parts[0];
            const msg = parts.slice(1).join(' ');
            return { index, hash, msg };
        });
    } catch (e) {
        return [];
    }
}

function getCurrentHash() {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch (e) {
        return '';
    }
}

function start() {
    const commits = getCommits();
    if (commits.length === 0) {
        console.log('No commits found or not a git repository.');
        process.exit(1);
    }

    function showMenu() {
        const currentHash = getCurrentHash();
        const currentIndex = commits.findIndex(c => c.hash === currentHash);

        console.clear();
        console.log('\x1b[36m=== REVENUE APP: COMMIT DRILL-DOWN ===\x1b[0m');
        console.log('Use numbers to jump, [N] for Next (Newer), [P] for Previous (Older), [Q] to Quit\n');

        commits.forEach((c, i) => {
            const isCurrent = c.hash === currentHash;
            const prefix = isCurrent ? '\x1b[32m ► ' : '   ';
            const suffix = isCurrent ? ' (CURRENT)\x1b[0m' : '';
            console.log(`${prefix}[${i}] ${c.hash} - ${c.msg}${suffix}`);
        });

        console.log('\n' + '-'.repeat(40));
        rl.question('Action: ', (input) => {
            const cmd = input.toLowerCase().trim();

            if (cmd === 'q') {
                rl.close();
                return;
            }

            let targetHash = null;

            if (cmd === 'n') {
                if (currentIndex > 0) {
                    targetHash = commits[currentIndex - 1].hash;
                } else {
                    console.log('\nAlready at the latest commit.');
                    setTimeout(showMenu, 1000);
                    return;
                }
            } else if (cmd === 'p') {
                if (currentIndex < commits.length - 1 && currentIndex !== -1) {
                    targetHash = commits[currentIndex + 1].hash;
                } else if (currentIndex === -1) {
                    // If detached or hash mismatch, go to first commit
                    targetHash = commits[0].hash;
                } else {
                    console.log('\nAlready at the oldest commit.');
                    setTimeout(showMenu, 1000);
                    return;
                }
            } else {
                const idx = parseInt(cmd);
                if (!isNaN(idx) && commits[idx]) {
                    targetHash = commits[idx].hash;
                }
            }

            if (targetHash) {
                try {
                    console.log(`\x1b[33mSwitching to ${targetHash}...\x1b[0m`);
                    execSync(`git checkout ${targetHash} --quiet`);
                    showMenu();
                } catch (e) {
                    console.log('\nError switching commits. Ensure you have no unstaged changes.');
                    setTimeout(showMenu, 2000);
                }
            } else {
                showMenu();
            }
        });
    }

    showMenu();
}

start();
