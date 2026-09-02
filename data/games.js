/* Seraph game list - the single source of truth for the homepage grid.
 *
 * To add a game:
 *   1. drop the game's folder in  games/<slug>/  (must contain index.html)
 *   2. add a line to `games` below; `slug` is that folder name
 *   3. `category` must be one of `categories` below, or add a new one there
 *      AND add a matching filter chip in index.html
 *
 * `collection: true` marks a folder that holds several games (styles it differently).
 * Nothing else needs editing - the grid, search, filters and star counts all
 * build themselves from this file.
 */
window.SERAPH_DATA = {
    categories: ["collection", "flash", "html5", "unity", "wasm", "turbowarp"],

    games: [
        { slug: "papas-games", title: "Papa's Games", icon: "🍕", tag: "17 games", category: "collection", collection: true },
        { slug: "vex-games", title: "Vex Games", icon: "🏃", tag: "7 games", category: "collection", collection: true },
        { slug: "gunmayhem-games", title: "Gun Mayhem", icon: "🔫", tag: "3 games", category: "collection", collection: true },
        { slug: "btd-games", title: "Bloons Tower Defense", icon: "🎈", tag: "4 games", category: "collection", collection: true },
        { slug: "espn-baseball", title: "ESPN Arcade Baseball", icon: "⚾", tag: "flash / ruffle", category: "flash", collection: false },
        { slug: "soflo-wheelie-life", title: "Soflo Wheelie Life", icon: "🏍", tag: "turbowarp", category: "turbowarp", collection: false },
        { slug: "gold-digger", title: "Gold Digger FRVR", icon: "⛏", tag: "html5", category: "html5", collection: false },
        { slug: "snow-rider-3d", title: "Snow Rider 3D", icon: "⛷", tag: "unity webgl", category: "unity", collection: false },
        { slug: "rocketsoccer", title: "Rocket Soccer", icon: "🏀", tag: "unity webgl", category: "unity", collection: false },
        { slug: "snowbattleio", title: "Snowbattle.io", icon: "❄", tag: "unity webgl", category: "unity", collection: false },
        { slug: "chess", title: "Chess", icon: "♞", tag: "html5", category: "html5", collection: false },
        { slug: "wordle", title: "Wordle", icon: "📝", tag: "html5", category: "html5", collection: false },
        { slug: "2048", title: "2048", icon: "🔢", tag: "html5", category: "html5", collection: false },
        { slug: "retrobowl", title: "Retro Bowl", icon: "🏈", tag: "html5", category: "html5", collection: false },
        { slug: "jetpackjoyride", title: "Jetpack Joyride", icon: "🚀", tag: "html5", category: "html5", collection: false },
        { slug: "sm64", title: "Super Mario 64", icon: "🍄", tag: "wasm", category: "wasm", collection: false },
        { slug: "bitlife", title: "BitLife", icon: "👤", tag: "unity webgl", category: "unity", collection: false },
        { slug: "tinyfishing", title: "Tiny Fishing", icon: "🎣", tag: "html5", category: "html5", collection: false },
        { slug: "drifthunters", title: "Drift Hunters", icon: "🚗", tag: "unity webgl", category: "unity", collection: false },
    ],

    // Shown in the separate 'in-testing' strip at the bottom of the page.
    testing: [
        { url: "https://tankgame.seraphweb.com:9998", external: true, title: "Tank Game", icon: "🞷", tag: "in-testing" },
        { slug: "mc", title: "Minecraft 1.5.2", icon: "⛏", tag: "eaglercraft" },
        { slug: "eagler1.8", title: "Eaglercraft 1.8", icon: "⛏", tag: "eaglercraft" },
        { slug: "mcclassic", title: "Minecraft Classic", icon: "⛏", tag: "web port" },
        { slug: "precisionclient", title: "Precision Client", icon: "⛏", tag: "eaglercraft" },
        { slug: "mctowerdefence2", title: "MC Tower Defence 2", icon: "⛏", tag: "flash" },
    ]
};
