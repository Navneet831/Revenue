"""
build_exe.py  —  GrewAnalytics Revenue .exe builder
Usage:  python build_exe.py

Stages only the production-relevant files then runs PyInstaller --onedir.
The staging directory is reused between runs; individual subtrees are
refreshed in-place so large re-copies (node_modules) are skipped unless
the --full flag is passed.

Output:  dist_staging/dist/GrewAnalytics/
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

ROOT        = Path(__file__).parent.absolute()
STAGING     = ROOT / 'dist_staging'
APP_NAME    = 'GrewAnalytics'
ICON        = ROOT / 'Logo.ico'

# Packages inside root node_modules that are ONLY needed for development.
# Removing them shrinks the bundle by ~200 MB.
DEV_PRUNE = [
    # type checkers / compilers
    'typescript', '@types', 'tslib',
    # build & bundler
    'vite', '@vitejs', '@rollup', 'rollup', 'esbuild',
    # test / bench
    '@playwright', 'playwright', 'jest', 'autocannon',
    # linters / formatters
    'eslint', 'prettier', 'eslint-config-prettier',
    # dev-only node tools
    'nodemon',
    # internal caches & cruft
    '.cache', '.bin',
]


def run(cmd: list, cwd: Path = None):
    print(f'  $ {" ".join(str(c) for c in cmd)}')
    # shell=True required on Windows for .cmd wrappers (npm, pyinstaller)
    r = subprocess.run(cmd, cwd=str(cwd) if cwd else None, shell=(os.name == 'nt'))
    if r.returncode != 0:
        print(f'  ERROR: command exited {r.returncode}')
        sys.exit(r.returncode)


def _force_remove(func, path, exc_info):
    """onerror handler: clear read-only flag then retry the remove."""
    import stat
    os.chmod(path, stat.S_IWRITE)
    func(path)


def sync_dir(src: Path, dst: Path, ignore=None):
    """Replace dst with a fresh copy of src (handles Windows read-only files)."""
    if not src.exists():
        print(f'  SKIP (not found): {src}')
        return
    if dst.exists():
        shutil.rmtree(dst, onerror=_force_remove)
    shutil.copytree(src, dst, ignore=ignore, symlinks=False)
    print(f'  synced  {src.relative_to(ROOT)}  ->  {dst.relative_to(STAGING)}')


# ─────────────────────────────────────────────────────────────────────────────
# STEP 0 – ensure web bundle and shared dist are up-to-date
# ─────────────────────────────────────────────────────────────────────────────
def step_build_assets():
    print('\n[0] Building shared package and web bundle...')
    run(['npm', 'run', 'build:shared'], cwd=ROOT)
    run(['npm', 'run', 'build:web'],    cwd=ROOT)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 – stage all production files
# ─────────────────────────────────────────────────────────────────────────────
def step_stage(full: bool):
    print(f'\n[1] Staging files  (full={full})...')
    STAGING.mkdir(exist_ok=True)

    # Python launcher
    shutil.copy2(ROOT / 'launcher.py', STAGING / 'launcher.py')
    print('  copied  launcher.py')

    # App icon
    shutil.copy2(ICON, STAGING / 'Logo.ico')
    print('  copied  Logo.ico')

    # .env  (DB creds + feature flags — required by env.js via ../../.env)
    shutil.copy2(ROOT / '.env', STAGING / '.env')
    print('  copied  .env')

    # Backend source  (no tests, no node_modules — uses root-level node_modules)
    sync_dir(
        ROOT / 'apps' / 'api',
        STAGING / 'apps' / 'api',
        ignore=shutil.ignore_patterns('node_modules', 'tests', '*.test.js', 'test_*.js'),
    )

    # Built web frontend (compiled JS/CSS only — not src/)
    sync_dir(
        ROOT / 'apps' / 'web' / 'dist',
        STAGING / 'apps' / 'web' / 'dist',
    )

    # Monitoring helpers (logging + metrics)
    sync_dir(
        ROOT / 'monitoring',
        STAGING / 'monitoring',
        ignore=shutil.ignore_patterns('node_modules'),
    )

    # Compiled shared package  (the dist/ that node_modules/@revenue/shared points to)
    sync_dir(
        ROOT / 'packages' / 'shared' / 'dist',
        STAGING / 'packages' / 'shared' / 'dist',
    )
    shutil.copy2(
        ROOT / 'packages' / 'shared' / 'package.json',
        STAGING / 'packages' / 'shared' / 'package.json',
    )
    print('  copied  packages/shared/package.json')

    # node_modules — large, skip on incremental unless --full
    nm_dst = STAGING / 'node_modules'
    if full or not nm_dst.exists():
        print('  copying node_modules (this takes a minute)...')
        sync_dir(
            ROOT / 'node_modules',
            nm_dst,
            ignore=shutil.ignore_patterns(*DEV_PRUNE),
        )
        # Ensure @revenue/shared workspace symlink is materialised as a real directory
        shared_link = nm_dst / '@revenue' / 'shared'
        if shared_link.is_symlink() or not (shared_link / 'dist').exists():
            if shared_link.exists() or shared_link.is_symlink():
                if shared_link.is_symlink():
                    shared_link.unlink()
                else:
                    shutil.rmtree(shared_link)
            shutil.copytree(
                ROOT / 'packages' / 'shared',
                shared_link,
                ignore=shutil.ignore_patterns('node_modules'),
                symlinks=False,
            )
            print('  materialised @revenue/shared symlink')
    else:
        # Incremental: only refresh @revenue/shared dist (may have changed)
        shared_dst_dist = nm_dst / '@revenue' / 'shared' / 'dist'
        sync_dir(ROOT / 'packages' / 'shared' / 'dist', shared_dst_dist)

    # Bundled node.exe  (skip if already staged — file may be locked by running server)
    node_dst = STAGING / 'node'
    node_dst.mkdir(exist_ok=True)
    node_dst_exe = node_dst / 'node.exe'
    if node_dst_exe.exists():
        print(f'  node.exe already staged, skipping copy')
    else:
        node_src = _find_node_exe()
        if node_src and node_src != node_dst_exe:
            shutil.copy2(node_src, node_dst_exe)
            print(f'  bundled node.exe from {node_src}')
        elif not node_src:
            print('  WARNING: node.exe not found — launcher will use system PATH')


def _find_node_exe() -> Path | None:
    # Already staged from a previous run?
    cached = STAGING / 'node' / 'node.exe'
    if cached.exists():
        return cached
    # Ask the shell
    try:
        result = subprocess.check_output(
            ['powershell', '-NoProfile', '-Command',
             '(Get-Command node -ErrorAction SilentlyContinue).Source'],
            text=True,
        ).strip()
        if result:
            return Path(result)
    except Exception:
        pass
    return None


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 – write the PyInstaller spec
# ─────────────────────────────────────────────────────────────────────────────
def step_write_spec():
    print('\n[2] Writing PyInstaller spec...')
    sep = os.pathsep
    spec = f"""\
# -*- mode: python ; coding: utf-8 -*-
# Auto-generated by build_exe.py — do not edit by hand.

a = Analysis(
    ['launcher.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('apps',         'apps'),
        ('monitoring',   'monitoring'),
        ('packages',     'packages'),
        ('node_modules', 'node_modules'),
        ('node',         'node'),
        ('.env',         '.'),
        ('Logo.ico',     '.'),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=1,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='{APP_NAME}',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    icon=['{ICON.as_posix()}'],
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='{APP_NAME}',
)
"""
    spec_path = STAGING / f'{APP_NAME}.spec'
    spec_path.write_text(spec, encoding='utf-8')
    print(f'  wrote {spec_path.relative_to(ROOT)}')
    return spec_path


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 – run PyInstaller
# ─────────────────────────────────────────────────────────────────────────────
def step_pyinstaller(spec_path: Path):
    print('\n[3] Running PyInstaller...')
    run(
        ['pyinstaller', '--noconfirm', str(spec_path.name)],
        cwd=STAGING,
    )


# ─────────────────────────────────────────────────────────────────────────────
def main():
    full = '--full' in sys.argv

    step_build_assets()
    step_stage(full=full)
    spec_path = step_write_spec()
    step_pyinstaller(spec_path)

    output = STAGING / 'dist' / APP_NAME
    print(f"""
{'='*56}
  Build complete!
  Output: {output}
  Run:    {output / (APP_NAME + '.exe')}
{'='*56}
""")


if __name__ == '__main__':
    main()
