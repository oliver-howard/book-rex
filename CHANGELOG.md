# Changelog

## [1.12.0](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.11.0...book-rex-v1.12.0) (2026-02-16)


### Features

* add progress reporting to AI recommendation generation for guest mode. ([05e5f88](https://github.com/oliver-howard/book-rex/commit/05e5f88e255c8dd1de89bb06bd0847c68b8782bc))
* Enhance AI personalization by instructing it to address the user directly as 'you' in recommendations, analyses, and profiles. ([8aac582](https://github.com/oliver-howard/book-rex/commit/8aac582416762003e28aea04aa25520d83abd44b))
* Implement guest mode, allowing unauthenticated users to temporarily manage data sources and settings. ([382fb57](https://github.com/oliver-howard/book-rex/commit/382fb578b4f08e791dcdab5bc5eec24f902a2265))

## [1.11.0](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.10.1...book-rex-v1.11.0) (2025-11-29)


### Features

* Implement user-managed book exclusion list to filter recommendations, not interested button ([baf52f4](https://github.com/oliver-howard/book-rex/commit/baf52f472b6a7e2caf9f45586557d5f633b1cec1))

## [1.10.1](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.10.0...book-rex-v1.10.1) (2025-11-24)


### Bug Fixes

* Add Hardcover API key verification and incorporate Hardcover into reading history detection. ([ca45ffa](https://github.com/oliver-howard/book-rex/commit/ca45ffa297d6620894dad4e92dfcd359c939e365))

## [1.10.0](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.9.2...book-rex-v1.10.0) (2025-11-23)


### Features

* Add Hardcover as a data source with per-user API key management and refactor client instantiation. ([953279a](https://github.com/oliver-howard/book-rex/commit/953279a8c09bd37c43727620a01bffc59dab2e00))
* fetch and map user book review data and remove unused genre placeholder. ([b6c7e93](https://github.com/oliver-howard/book-rex/commit/b6c7e934fa32841f926f6d24466a7840b4cb9f84))
* Implement dynamic 'Add/Remove to TBR' button with visual feedback and reorder reading history source priority. ([bffab34](https://github.com/oliver-howard/book-rex/commit/bffab344c367d07b9222ef1d98dc63409bb39d16))
* Make bar chart width responsive, increase right margin, and add x-axis padding. ([70c77b8](https://github.com/oliver-howard/book-rex/commit/70c77b8bb20c13120cc9ff31dff0a7928ddddbd3))

## [1.9.2](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.9.1...book-rex-v1.9.2) (2025-11-20)


### Bug Fixes

* Implement collapsible BookLore settings section with credential verification and improved error handling. ([61e97de](https://github.com/oliver-howard/book-rex/commit/61e97de3478f381a42adb301ce9343e2ffd3c4a6))

## [1.9.1](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.9.0...book-rex-v1.9.1) (2025-11-20)


### Bug Fixes

* use `logger` utility for debug and enhanced authentication error messages ([d43bf61](https://github.com/oliver-howard/book-rex/commit/d43bf61f52d39f8c8bd7f095920bbc1e91bd4f21))

## [1.9.0](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.8.0...book-rex-v1.9.0) (2025-11-20)


### Features

* Add detailed error logging to recommendation stream endpoints and an initial SSE buffer flush ping. ([a33fa4d](https://github.com/oliver-howard/book-rex/commit/a33fa4d50313e436652c325244c7094ed4b4af06))

## [1.8.0](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.7.0...book-rex-v1.8.0) (2025-11-20)


### Features

* Add exclusion list to AI prompts to prevent recommending already-read books and increase detailed history context to 100 ([a23957a](https://github.com/oliver-howard/book-rex/commit/a23957af164a82ecec5b2a8cdf53e05d27830a7e))
* Add new API controllers for recommendations, auth, TBR, admin, and settings, introduce a service factory, and optimize BookLore client note fetching. ([ced01df](https://github.com/oliver-howard/book-rex/commit/ced01dffbce90ddf2a296c53218c817a6c10337a))
* enhance book search accuracy with weighted matching and improve client-side event handling. ([7522ae4](https://github.com/oliver-howard/book-rex/commit/7522ae4f3aacb013b2eab63b1ef0a22290042fbc))
* enhance loadTBR functionality with loader and hero refresh options ([3e01535](https://github.com/oliver-howard/book-rex/commit/3e01535634e465493670fbb41f098233e3c6bfde))
* Enhance styling and layout for user info, navigation pills, sidebar footer, and theme toggle components. ([eacc289](https://github.com/oliver-howard/book-rex/commit/eacc289938b6990eeedc0f956fe9b14775ddfd14))
* Implement mobile sidebar auto-hide functionality and enhance responsive design ([412783e](https://github.com/oliver-howard/book-rex/commit/412783e4bebdaad26cce80c247e5219d58e2bbf3))
* Implement Server-Sent Events (SSE) for real-time progress tracking during recommendation generation with a new frontend progress bar. ([bd59a40](https://github.com/oliver-howard/book-rex/commit/bd59a40e902a410d5ddc7055d2bacc3eeac92120))
* **ui:** enhance profile card and chart styles with improved layout and visuals ([7ea5f8d](https://github.com/oliver-howard/book-rex/commit/7ea5f8d086e4c73b99a5cb44e1038a1a59ce72b4))
* **ui:** restyle dashboard, settings, and stats with new sidebar hero and preview action ([a6f9573](https://github.com/oliver-howard/book-rex/commit/a6f9573b30ba52404f91142d4810dffc9f5df427))

## [1.7.0](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.6.1...book-rex-v1.7.0) (2025-11-19)


### Features

* Add Amazon and Hardcover action buttons to the book details modal. ([c4a67cb](https://github.com/oliver-howard/book-rex/commit/c4a67cbf9c25f7f2434ef55704e9da699cceb1bd))
* Add book details modal with data fetched from the Hardcover API. ([ece288d](https://github.com/oliver-howard/book-rex/commit/ece288d3e9e05e1460deb7c92375ba758b305cb1))
* Display book cover images ([a4a3d83](https://github.com/oliver-howard/book-rex/commit/a4a3d8379e271e6b8c9098c3c7a81a7832138bca))

## [1.6.1](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.6.0...book-rex-v1.6.1) (2025-11-18)


### Bug Fixes

* add cache busting for css ([f7c5f06](https://github.com/oliver-howard/book-rex/commit/f7c5f06d67e279db3cb92b693dfa34f295c2f61e))

## [1.6.0](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.5.5...book-rex-v1.6.0) (2025-11-18)


### Features

* add reader profile summary ([33c75d2](https://github.com/oliver-howard/book-rex/commit/33c75d2d73fe0dc6143656acf1f6f07b1ffc87aa))

## [1.5.5](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.5.4...book-rex-v1.5.5) (2025-11-18)


### Bug Fixes

* **auth:** add cache busting ([5bb5030](https://github.com/oliver-howard/book-rex/commit/5bb50307c9b3d753477526f31d3250833439b626))

## [1.5.4](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.5.3...book-rex-v1.5.4) (2025-11-18)


### Bug Fixes

* **auth:** add cookie policy, network error logging ([23242a2](https://github.com/oliver-howard/book-rex/commit/23242a2b06d827a76b8652f935b8086b6d26e019))
* **auth:** add guard clause for login modal ([2e90912](https://github.com/oliver-howard/book-rex/commit/2e9091256c153cee9a990786d7ad6fa90ddd1431))

## [1.5.3](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.5.2...book-rex-v1.5.3) (2025-11-18)


### Bug Fixes

* **auth:** login modal bug ([2824f48](https://github.com/oliver-howard/book-rex/commit/2824f4837621f6b402a07cf321d713bed729cf7b))

## [1.5.2](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.5.1...book-rex-v1.5.2) (2025-11-18)


### Bug Fixes

* **auth:** add debugging for authentication ([7fd4c23](https://github.com/oliver-howard/book-rex/commit/7fd4c23d13ff27f76f1444c97b927d09b4234a07))

## [1.5.1](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.5.0...book-rex-v1.5.1) (2025-11-18)


### Bug Fixes

* **auth:** prevent caching of auth status to resolve login loop ([b83f1a9](https://github.com/oliver-howard/book-rex/commit/b83f1a94220649e859baaf284b2844773eec8ec1))

## [1.5.0](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.4.1...book-rex-v1.5.0) (2025-11-18)


### Features

* add stats visualizations ([0c6f942](https://github.com/oliver-howard/book-rex/commit/0c6f94281eba97835e460d19b7d005e6d672c294))
* **ui:** add seperate page for settings/stats ([#12](https://github.com/oliver-howard/book-rex/issues/12)) ([49d8360](https://github.com/oliver-howard/book-rex/commit/49d83604d1c5b1b18a31356023f27db363335416))

## [1.4.1](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.4.0...book-rex-v1.4.1) (2025-11-18)


### Bug Fixes

* **ui:** update version indicator ([6c5152c](https://github.com/oliver-howard/book-rex/commit/6c5152c120dd39d8b23ac5bf3586caa368c1fd83))

## [1.4.0](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.3.0...book-rex-v1.4.0) (2025-11-17)


### Features

* **ui:** update hero text ([0327713](https://github.com/oliver-howard/book-rex/commit/0327713fa73821858d0be2c2983c0444f6e9495e))

## [1.3.0](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.2.0...book-rex-v1.3.0) (2025-11-17)


### Features

* 'View on Amazon' links ([c29e4eb](https://github.com/oliver-howard/book-rex/commit/c29e4ebd95cf6c1e610aedfbaee241bb8b8f5cb1))
* add admin user ([2e7f5aa](https://github.com/oliver-howard/book-rex/commit/2e7f5aa2d0e2e1032fd66be4ff2506e07ea03fc3))
* add Amazon affiliate link support ([1589e80](https://github.com/oliver-howard/book-rex/commit/1589e80cb0f485075785b3ca657ae9fff03c5a60))
* add data source toggle ([2020b39](https://github.com/oliver-howard/book-rex/commit/2020b393565f338882db81908312892333d19fe2))
* add Goodreads support as data source ([3ce636e](https://github.com/oliver-howard/book-rex/commit/3ce636e3fa51b57afefc4b0a261c72816d13e31b))
* add light/dark theme ([cb90dba](https://github.com/oliver-howard/book-rex/commit/cb90dba1ce2a5b17d0c42fd281aa5353f998462c))
* add login/authentication for BookLore within UI ([4c31924](https://github.com/oliver-howard/book-rex/commit/4c31924953e34c74d6d0d480b747ec0ae36acad5))
* add SQLite DB to track users, data sources, and TBR ([343d3cf](https://github.com/oliver-howard/book-rex/commit/343d3cfd3970c0bb3fdc822c9fe5c48aa27ef406))
* add support for AMD/Linux hosting ([eda6b07](https://github.com/oliver-howard/book-rex/commit/eda6b07c105d94e7023d8bb0687775d800c6e024))
* add tbr shelf and guest mode ([bae2076](https://github.com/oliver-howard/book-rex/commit/bae20761df3fd3afda235150488513a02152916e))
* add web interface and containerized deployment ([a0758a4](https://github.com/oliver-howard/book-rex/commit/a0758a417413614ab437fca1d3ff640d51b6b468))
* remember username toggle ([bef5439](https://github.com/oliver-howard/book-rex/commit/bef543904322babad0a0f122554d19e1e6546c81))
* UI polish ([b2fa0f3](https://github.com/oliver-howard/book-rex/commit/b2fa0f3a3e006307c57f54a10f42988f4b067cdc))
* UI rebrand to Book Rex ([5801c7c](https://github.com/oliver-howard/book-rex/commit/5801c7c81de8dc40e5d830a21c5fea4ffc9d64c2))
* update login screen ([f7ea9c8](https://github.com/oliver-howard/book-rex/commit/f7ea9c8aea5ee199986c742494b07085a0423c4d))


### Bug Fixes

* 'Get my next book' button ([ec3eb0e](https://github.com/oliver-howard/book-rex/commit/ec3eb0e8c3b306b31717fb27f4c3d640d13c7047))
* recommendation duplicates already on TBR ([d8fb59e](https://github.com/oliver-howard/book-rex/commit/d8fb59e892fec727158e5fb15f1e2117fbc51e90))

## [1.2.0](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.1.0...book-rex-v1.2.0) (2025-11-17)


### Features

* 'View on Amazon' links ([c29e4eb](https://github.com/oliver-howard/book-rex/commit/c29e4ebd95cf6c1e610aedfbaee241bb8b8f5cb1))
* add admin user ([2e7f5aa](https://github.com/oliver-howard/book-rex/commit/2e7f5aa2d0e2e1032fd66be4ff2506e07ea03fc3))
* add Amazon affiliate link support ([1589e80](https://github.com/oliver-howard/book-rex/commit/1589e80cb0f485075785b3ca657ae9fff03c5a60))
* add data source toggle ([2020b39](https://github.com/oliver-howard/book-rex/commit/2020b393565f338882db81908312892333d19fe2))
* add Goodreads support as data source ([3ce636e](https://github.com/oliver-howard/book-rex/commit/3ce636e3fa51b57afefc4b0a261c72816d13e31b))
* add light/dark theme ([cb90dba](https://github.com/oliver-howard/book-rex/commit/cb90dba1ce2a5b17d0c42fd281aa5353f998462c))
* add login/authentication for BookLore within UI ([4c31924](https://github.com/oliver-howard/book-rex/commit/4c31924953e34c74d6d0d480b747ec0ae36acad5))
* add SQLite DB to track users, data sources, and TBR ([343d3cf](https://github.com/oliver-howard/book-rex/commit/343d3cfd3970c0bb3fdc822c9fe5c48aa27ef406))
* add support for AMD/Linux hosting ([eda6b07](https://github.com/oliver-howard/book-rex/commit/eda6b07c105d94e7023d8bb0687775d800c6e024))
* add tbr shelf and guest mode ([bae2076](https://github.com/oliver-howard/book-rex/commit/bae20761df3fd3afda235150488513a02152916e))
* add web interface and containerized deployment ([a0758a4](https://github.com/oliver-howard/book-rex/commit/a0758a417413614ab437fca1d3ff640d51b6b468))
* remember username toggle ([bef5439](https://github.com/oliver-howard/book-rex/commit/bef543904322babad0a0f122554d19e1e6546c81))
* UI polish ([b2fa0f3](https://github.com/oliver-howard/book-rex/commit/b2fa0f3a3e006307c57f54a10f42988f4b067cdc))
* UI rebrand to Book Rex ([5801c7c](https://github.com/oliver-howard/book-rex/commit/5801c7c81de8dc40e5d830a21c5fea4ffc9d64c2))
* update login screen ([f7ea9c8](https://github.com/oliver-howard/book-rex/commit/f7ea9c8aea5ee199986c742494b07085a0423c4d))


### Bug Fixes

* 'Get my next book' button ([ec3eb0e](https://github.com/oliver-howard/book-rex/commit/ec3eb0e8c3b306b31717fb27f4c3d640d13c7047))
* recommendation duplicates already on TBR ([d8fb59e](https://github.com/oliver-howard/book-rex/commit/d8fb59e892fec727158e5fb15f1e2117fbc51e90))

## [1.1.0](https://github.com/oliver-howard/book-rex/compare/book-rex-v1.0.2...book-rex-v1.1.0) (2025-11-17)


### Features

* 'View on Amazon' links ([c29e4eb](https://github.com/oliver-howard/book-rex/commit/c29e4ebd95cf6c1e610aedfbaee241bb8b8f5cb1))
* add admin user ([2e7f5aa](https://github.com/oliver-howard/book-rex/commit/2e7f5aa2d0e2e1032fd66be4ff2506e07ea03fc3))
* add Amazon affiliate link support ([1589e80](https://github.com/oliver-howard/book-rex/commit/1589e80cb0f485075785b3ca657ae9fff03c5a60))
* add data source toggle ([2020b39](https://github.com/oliver-howard/book-rex/commit/2020b393565f338882db81908312892333d19fe2))
* add Goodreads support as data source ([3ce636e](https://github.com/oliver-howard/book-rex/commit/3ce636e3fa51b57afefc4b0a261c72816d13e31b))
* add light/dark theme ([cb90dba](https://github.com/oliver-howard/book-rex/commit/cb90dba1ce2a5b17d0c42fd281aa5353f998462c))
* add login/authentication for BookLore within UI ([4c31924](https://github.com/oliver-howard/book-rex/commit/4c31924953e34c74d6d0d480b747ec0ae36acad5))
* add SQLite DB to track users, data sources, and TBR ([343d3cf](https://github.com/oliver-howard/book-rex/commit/343d3cfd3970c0bb3fdc822c9fe5c48aa27ef406))
* add support for AMD/Linux hosting ([eda6b07](https://github.com/oliver-howard/book-rex/commit/eda6b07c105d94e7023d8bb0687775d800c6e024))
* add tbr shelf and guest mode ([bae2076](https://github.com/oliver-howard/book-rex/commit/bae20761df3fd3afda235150488513a02152916e))
* add web interface and containerized deployment ([a0758a4](https://github.com/oliver-howard/book-rex/commit/a0758a417413614ab437fca1d3ff640d51b6b468))
* remember username toggle ([bef5439](https://github.com/oliver-howard/book-rex/commit/bef543904322babad0a0f122554d19e1e6546c81))
* UI polish ([b2fa0f3](https://github.com/oliver-howard/book-rex/commit/b2fa0f3a3e006307c57f54a10f42988f4b067cdc))
* UI rebrand to Book Rex ([5801c7c](https://github.com/oliver-howard/book-rex/commit/5801c7c81de8dc40e5d830a21c5fea4ffc9d64c2))
* update login screen ([f7ea9c8](https://github.com/oliver-howard/book-rex/commit/f7ea9c8aea5ee199986c742494b07085a0423c4d))


### Bug Fixes

* 'Get my next book' button ([ec3eb0e](https://github.com/oliver-howard/book-rex/commit/ec3eb0e8c3b306b31717fb27f4c3d640d13c7047))
* recommendation duplicates already on TBR ([d8fb59e](https://github.com/oliver-howard/book-rex/commit/d8fb59e892fec727158e5fb15f1e2117fbc51e90))
