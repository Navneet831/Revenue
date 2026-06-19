Microsoft Windows \[Version 10.0.26200.8655]

(c) Microsoft Corporation. All rights reserved.



C:\\Users\\navneet.chaudhary>cd /d "D:\\OneDrive - CHIRIPAL RENEWABLE ENERGY PRIVATE LIMITED\\Desktop\\DB1\\GrewAnalytics\\apps\\Revenue"



D:\\OneDrive - CHIRIPAL RENEWABLE ENERGY PRIVATE LIMITED\\Desktop\\DB1\\GrewAnalytics\\apps\\Revenue>python build\_exe.py --full



\[0] Building shared package and web bundle...

&#x20; $ npm run build:shared



> revenue-monorepo@1.0.0 build:shared

> npm run build -w packages/shared





> @revenue/shared@1.0.0 build

> tsc



&#x20; $ npm run build:web



> revenue-monorepo@1.0.0 build:web

> npm run build -w apps/web





> @revenue/web@1.0.0 build

> vite build



vite v5.4.21 building for production...

✓ 2013 modules transformed.

dist/index.html                                 2.59 kB │ gzip:  1.05 kB

dist/assets/index-BJwzFhNp.css                 45.42 kB │ gzip:  9.36 kB

dist/assets/ListChartCore-BWZmXXBO.js           0.30 kB │ gzip:  0.23 kB

dist/assets/ChartCore-4aLShToe.js               0.53 kB │ gzip:  0.34 kB

dist/assets/InsightsPanel-BPtS-Jd-.js           4.29 kB │ gzip:  1.77 kB

dist/assets/ExecutiveStories--wp5yVWO.js        6.08 kB │ gzip:  2.20 kB

dist/assets/vendor-observability-DO-kqLEV.js   18.40 kB │ gzip:  6.30 kB

dist/assets/RevenueDashboard-BKkjmh58.js       67.76 kB │ gzip: 21.25 kB

dist/assets/index-CxftTy3H.js                  70.42 kB │ gzip: 20.78 kB

dist/assets/vendor-react-BO0u9XAB.js          133.94 kB │ gzip: 43.14 kB

dist/assets/vendor-charts-DQWEGEaz.js         245.67 kB │ gzip: 84.76 kB

dist/assets/index-PovdYY2r.js                 422.35 kB │ gzip: 95.62 kB

✓ built in 7.52s



\[1] Staging files  (full=True)...

&#x20; copied  launcher.py

&#x20; copied  Logo.ico

&#x20; copied  .env

&#x20; synced  apps\\api  ->  apps\\api

&#x20; synced  apps\\web\\dist  ->  apps\\web\\dist

&#x20; synced  monitoring  ->  monitoring

&#x20; synced  packages\\shared\\dist  ->  packages\\shared\\dist

&#x20; copied  packages/shared/package.json

&#x20; copying node\_modules (this takes a minute)...

&#x20; synced  node\_modules  ->  node\_modules

&#x20; node.exe already staged, skipping copy



\[2] Writing PyInstaller spec...

&#x20; wrote dist\_staging\\GrewAnalytics.spec



\[3] Running PyInstaller...

&#x20; $ pyinstaller --noconfirm GrewAnalytics.spec

261 INFO: PyInstaller: 6.20.0, contrib hooks: 2026.5

261 INFO: Python: 3.12.10

332 INFO: Platform: Windows-11-10.0.26200-SP0

332 INFO: Python environment: C:\\Users\\navneet.chaudhary\\AppData\\Local\\Programs\\Python\\Python312

350 INFO: Module search paths (PYTHONPATH):

\['C:\\\\Users\\\\navneet.chaudhary\\\\AppData\\\\Local\\\\Programs\\\\Python\\\\Python312\\\\Scripts\\\\pyinstaller.exe',

&#x20;'C:\\\\Users\\\\navneet.chaudhary\\\\AppData\\\\Local\\\\Programs\\\\Python\\\\Python312\\\\python312.zip',

&#x20;'C:\\\\Users\\\\navneet.chaudhary\\\\AppData\\\\Local\\\\Programs\\\\Python\\\\Python312\\\\DLLs',

&#x20;'C:\\\\Users\\\\navneet.chaudhary\\\\AppData\\\\Local\\\\Programs\\\\Python\\\\Python312\\\\Lib',

&#x20;'C:\\\\Users\\\\navneet.chaudhary\\\\AppData\\\\Local\\\\Programs\\\\Python\\\\Python312',

&#x20;'C:\\\\Users\\\\navneet.chaudhary\\\\AppData\\\\Roaming\\\\Python\\\\Python312\\\\site-packages',

&#x20;'C:\\\\Users\\\\navneet.chaudhary\\\\AppData\\\\Local\\\\Programs\\\\Python\\\\Python312\\\\Lib\\\\site-packages',

&#x20;'D:\\\\OneDrive - CHIRIPAL RENEWABLE ENERGY PRIVATE '

&#x20;'LIMITED\\\\Desktop\\\\DB1\\\\GrewAnalytics\\\\apps\\\\Revenue\\\\dist\_staging']

1325 INFO: Appending 'datas' from .spec

2521 INFO: checking Analysis

3336 INFO: Building because \_input\_datas changed

3336 INFO: Looking for Python shared library...

3336 INFO: Using Python shared library: C:\\Users\\navneet.chaudhary\\AppData\\Local\\Programs\\Python\\Python312\\python312.dll

3336 INFO: Running Analysis Analysis-00.toc

3338 INFO: Target bytecode optimization level: 1

3338 INFO: Initializing module dependency graph...

3338 INFO: Initializing module graph hook caches...

3386 INFO: Analyzing modules for base\_library.zip ...

6761 INFO: Processing standard module hook 'hook-encodings.py' from 'C:\\\\Users\\\\navneet.chaudhary\\\\AppData\\\\Local\\\\Programs\\\\Python\\\\Python312\\\\Lib\\\\site-packages\\\\PyInstaller\\\\hooks'

10085 INFO: Processing standard module hook 'hook-pickle.py' from 'C:\\\\Users\\\\navneet.chaudhary\\\\AppData\\\\Local\\\\Programs\\\\Python\\\\Python312\\\\Lib\\\\site-packages\\\\PyInstaller\\\\hooks'

11224 INFO: Processing standard module hook 'hook-heapq.py' from 'C:\\\\Users\\\\navneet.chaudhary\\\\AppData\\\\Local\\\\Programs\\\\Python\\\\Python312\\\\Lib\\\\site-packages\\\\PyInstaller\\\\hooks'

11711 INFO: Caching module dependency graph...

11770 INFO: Analyzing D:\\OneDrive - CHIRIPAL RENEWABLE ENERGY PRIVATE LIMITED\\Desktop\\DB1\\GrewAnalytics\\apps\\Revenue\\dist\_staging\\launcher.py

11820 INFO: Processing module hooks (post-graph stage)...

12146 INFO: Performing binary vs. data reclassification (24074 entries)

629844 INFO: Looking for ctypes DLLs

629847 INFO: Analyzing run-time hooks ...

629847 INFO: Including run-time hook 'pyi\_rth\_inspect.py' from 'C:\\\\Users\\\\navneet.chaudhary\\\\AppData\\\\Local\\\\Programs\\\\Python\\\\Python312\\\\Lib\\\\site-packages\\\\PyInstaller\\\\hooks\\\\rthooks'

630397 INFO: Creating base\_library.zip...

630621 INFO: Looking for dynamic libraries

630815 INFO: Extra DLL search directories (AddDllDirectory): \[]

630815 INFO: Extra DLL search directories (PATH): \[]

631376 INFO: Warnings written to D:\\OneDrive - CHIRIPAL RENEWABLE ENERGY PRIVATE LIMITED\\Desktop\\DB1\\GrewAnalytics\\apps\\Revenue\\dist\_staging\\build\\GrewAnalytics\\warn-GrewAnalytics.txt

631385 INFO: Graph cross-reference written to D:\\OneDrive - CHIRIPAL RENEWABLE ENERGY PRIVATE LIMITED\\Desktop\\DB1\\GrewAnalytics\\apps\\Revenue\\dist\_staging\\build\\GrewAnalytics\\xref-GrewAnalytics.html

632330 INFO: checking PYZ

632346 INFO: checking PKG

632367 INFO: Bootloader C:\\Users\\navneet.chaudhary\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\PyInstaller\\bootloader\\Windows-64bit-intel\\run.exe

632367 INFO: checking EXE

632570 INFO: checking COLLECT

632570 INFO: Building COLLECT because COLLECT-00.toc is non existent

632570 INFO: Removing dir D:\\OneDrive - CHIRIPAL RENEWABLE ENERGY PRIVATE LIMITED\\Desktop\\DB1\\GrewAnalytics\\apps\\Revenue\\dist\_staging\\dist\\GrewAnalytics

634831 INFO: Building COLLECT COLLECT-00.toc

Traceback (most recent call last):

&#x20; File "<frozen runpy>", line 198, in \_run\_module\_as\_main

&#x20; File "<frozen runpy>", line 88, in \_run\_code

&#x20; File "C:\\Users\\navneet.chaudhary\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\pyinstaller.exe\\\_\_main\_\_.py", line 5, in <module>

&#x20; File "C:\\Users\\navneet.chaudhary\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\PyInstaller\\\_\_main\_\_.py", line 231, in \_console\_script\_run

&#x20;   run()

&#x20; File "C:\\Users\\navneet.chaudhary\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\PyInstaller\\\_\_main\_\_.py", line 215, in run

&#x20;   run\_build(pyi\_config, spec\_file, \*\*vars(args))

&#x20; File "C:\\Users\\navneet.chaudhary\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\PyInstaller\\\_\_main\_\_.py", line 70, in run\_build

&#x20;   PyInstaller.building.build\_main.main(pyi\_config, spec\_file, \*\*kwargs)

&#x20; File "C:\\Users\\navneet.chaudhary\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\PyInstaller\\building\\build\_main.py", line 1275, in main

&#x20;   build(specfile, distpath, workpath, clean\_build)

&#x20; File "C:\\Users\\navneet.chaudhary\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\PyInstaller\\building\\build\_main.py", line 1213, in build

&#x20;   exec(code, spec\_namespace)

&#x20; File "GrewAnalytics.spec", line 40, in <module>

&#x20;   coll = COLLECT(

&#x20;          ^^^^^^^^

&#x20; File "C:\\Users\\navneet.chaudhary\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\PyInstaller\\building\\api.py", line 1150, in \_\_init\_\_

&#x20;   self.\_\_postinit\_\_()

&#x20; File "C:\\Users\\navneet.chaudhary\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\PyInstaller\\building\\datastruct.py", line 184, in \_\_postinit\_\_

&#x20;   self.assemble()

&#x20; File "C:\\Users\\navneet.chaudhary\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\PyInstaller\\building\\api.py", line 1227, in assemble

&#x20;   shutil.copyfile(src\_name, dest\_path)

&#x20; File "C:\\Users\\navneet.chaudhary\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\shutil.py", line 262, in copyfile

&#x20;   with open(dst, 'wb') as fdst:

&#x20;        ^^^^^^^^^^^^^^^

FileNotFoundError: \[Errno 2] No such file or directory: 'D:\\\\OneDrive - CHIRIPAL RENEWABLE ENERGY PRIVATE LIMITED\\\\Desktop\\\\DB1\\\\GrewAnalytics\\\\apps\\\\Revenue\\\\dist\_staging\\\\dist\\\\GrewAnalytics\\\\\_internal\\\\node\_modules\\\\@sentry-internal\\\\browser-utils\\\\build\\\\types-ts3.8\\\\metrics\\\\web-vitals\\\\lib\\\\polyfills\\\\interactionCountPolyfill.d.ts'

&#x20; ERROR: command exited 1



D:\\OneDrive - CHIRIPAL RENEWABLE ENERGY PRIVATE LIMITED\\Desktop\\DB1\\GrewAnalytics\\apps\\Revenue>

