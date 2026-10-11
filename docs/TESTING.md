# Testing NXE Deck on a Steam Deck

v0.6 adds the Library skin (new checklist section below). v0.2 fixed what the first hardware run (v0.1) showed: everything was 1.5× too big (the Deck renders its UI at 854×534 CSS px scaled 1.5×), the case bands showed escape codes, and the L1/R1 hints for the home tabs were invisible. It also adds the NXE green background and turns carousel depth on. The emulator is now calibrated against the v0.1 screenshot from a real Deck.

Expected results for each screen are in [`expected/`](expected/).

## 1. Install

You need Decky Loader with CSS Loader installed on the Deck.

**Option A: copy the folder (no setup).**
1. Run `tools/package.sh` on the Mac. It writes `dist/NXE-Deck-<version>.zip`.
2. Get the zip onto the Deck (USB stick, cloud drive, or KDE Connect), then switch to Desktop Mode.
3. Extract it so that the folder sits at `/home/deck/homebrew/themes/NXE Deck/`, with `theme.json` directly inside it. The folder name must be exactly `NXE Deck`: the fonts and the Wallpaper picker's default image are loaded from that path, and CSS Loader refuses to load the theme ("Image Picker specified image does not exist") if the name differs.
   **When updating, move the old folder out of `themes` first.** Otherwise the file manager may extract into a renamed folder (such as `NXE Deck (1)`), and that copy fails to load. Renaming it inside `themes` isn't enough, because CSS Loader loads every folder there.
4. Return to Game Mode.

**Option B: SSH (best for repeated tweaks).**
1. In Desktop Mode, open Konsole, set a password with `passwd`, then run `sudo systemctl enable --now sshd`.
2. On the Mac, run `ssh-copy-id deck@<deck-ip>` once.
3. After each change, run `DECK=deck@<deck-ip> tools/deploy.sh` on the Mac. It runs the static checks first, then copies the theme over.

**Turn it on:** press `…` to open Quick Access, go to Decky → CSS Loader, refresh the theme list, then enable **NXE Deck**. Disable other themes for this pass so they don't interfere.

## 2. First look, with debug outlines

In CSS Loader, open NXE Deck's options and turn on **Debug outlines**. Every element the theme targets gets a dashed outline, so a missing outline means that selector missed.

| Colour | Where | Should be outlined |
|---|---|---|
| Orange | Home | page area, "Recent Games" pill, each carousel item, the title under the focused game, the lower section, each tab, each news category label and info panel, top bar, footer |
| Cyan | Steam menu | the panel, every menu item, the separator above a running game (if one is running) |
| Magenta | Quick Access | the panel, the icon rail, each rail tab, the header band, row labels, every toggle, every slider track and thumb, every button (Decky's plugin list too) |
| Green | Library, game page | Library: the page, each tab, the "Sorted by" bar, each section header, each capsule, each collection tile. Game page: the page, the Play button, the controller and settings buttons, each tab, each activity card, each button |

Compare with `expected/*-debug-outlines.png`. Take a screenshot (**Steam + R1**) of anything that's missing, then turn debug outlines off.

## 3. Checklist

Tick each item, or note what you saw instead.

**Steam menu (press the Steam button)**
- [ ] Opens as a dark panel (no band at the top), list starting just under the top bar, like `expected/steam-menu.png`. The panel fits the menu's window: nothing is cut off on the right.
- [ ] Closes completely. **No sliver of the panel stays on screen.**
- [ ] The focused item is a silver bar with dark text, and moves with the D-pad.
- [ ] An accent tab sits inside the left edge of the silver bar and moves with it; the current page (Home) keeps a faint tint. **Moving down, the rows don't shift sideways.**
- [ ] A thin divider sits above **Power**.
- [ ] With a game running: the running game's entry and separator look reasonable.
- [ ] In a game, Steam button → the game: the Steam menu folds to an icon strip (icons centred, nothing sliding sideways) and the game's panel opens: the sky behind it, the rows (Resume game, Controller settings, …, Exit game) on a dark panel, the focused row a silver bar with an accent tab, the current row faintly tinted; the preview side shows the sky. Like `expected/in-game-panel.png`.
- [ ] In a game, the panel's Achievements: at the top, the summary (art, title, progress) and the list look as before. Moving down the list, the summary fades and folds away within the first couple of rows and the list fills the panel, tabs at the top; the focused achievement always stays on screen. Back at the top of the list, the summary returns. Like `expected/achievements-fold.png`. The same applies to a game's Achievements page outside a game.

**Quick Access (`…` button)**
- [ ] The header band ("QUICK SETTINGS") is glossy green with dark text, on every tab including Decky plugins.
- [ ] The selected rail tab is a green band, and focus on it shows a white ring.
- [ ] Brightness and volume sliders: green fill that follows the value, silver sphere thumb centred on the fill edge, and an accent ring when focused.
- [ ] Toggles: the knob sits fully left when off and fully right when on, the green fill appears only when on, and the knob gets an accent ring when focused.
- [ ] The focused row (a slider or toggle) gets an accent-tinted strip with an accent edge on the left, not Steam's flat grey.
- [ ] Decky tab: plugin buttons are dark glossy keys; the focused one is a silver bar with dark text and an accent tab at its left, and no grey strip behind it, like `expected/quick-access-decky.png`. The store and settings icons on the header band look recessed into it and turn silver when focused.
- [ ] Inside a plugin (e.g. CSS Loader): its buttons and dropdowns use the same keys.
- [ ] Settings (Steam menu → Settings): toggles and sliders there use the same style (intended).

**Home**
- [ ] Lime sky with bokeh over a silver floor, with no dark blurred game art. The top bar icons and clock are white and readable.
- [ ] "Recent Games" pill is visible and **still there after 10 seconds** (Steam normally fades it out).
- [ ] Capsules have floor reflections. Portrait capsules have the green "STEAM DECK" band. The first capsule is wide.
- [ ] The focused capsule has a clear white rim plus a green ring.
- [ ] The title and "LAST TWO WEEKS…" line under the focused game are dark text, fully visible, and clear of the reflection.
- [ ] Lower section is a light panel, including after scrolling down to the news. Tabs are dark text, the selected tab is a dark pill, and the Friends badge is green.
- [ ] **L1/R1 switch between What's New, Friends and Recommended**, also while a news card is focused. Dark L1/R1 hints show at both ends of the tab row. Friends shows dark tiles with white text; Recommended shows a dark "Play Next" heading. The page changes straight away, with a short slide, each time you switch, including when switching back quickly.
- [ ] News cards are white with dark titles. Category labels are green for News and blue for others.
- [ ] Scroll down inside What's New: "Recently completed" and the store carousel have dark headers, and the recently-completed tiles are dark with white text.
- [ ] Footer is light with dark button glyphs.
- [ ] **Floor line** slider: pick the value where the horizon sits just under the capsules (default 57%).
- [ ] **Leak check:** open the Store and Settings. Their top bar and footer must look normal, never dark text on a dark background.

**Library (Steam menu → Library)**
- [ ] A clean, darker accent sky behind the grid (no bubbles, no dark navy), like `expected/library.png`. All text stays white and readable.
- [ ] The tab strip behind the top bar and tabs is a dark graphite band with a thin accent line along its bottom. The selected tab is a silver bar with dark text; focusing the tab row adds the accent ring.
- [ ] L1/R1 and left/right on the tab row switch tabs (Great on Deck, All Games, Installed, …), and the grid changes each time.
- [ ] Capsules have a faint rim and the "STEAM DECK" band (Case bands option). The focused capsule has a white rim plus an accent ring around it, and no coloured glow behind it.
- [ ] Scroll down: the section label that sticks under the tabs stays readable over the capsules (if Steam fades in a band behind it, it's graphite with an accent line), and an outgoing label slides **under** the tab strip, not over it.
- [ ] Collections tab: dark glossy tiles; the focused tile is a deep accent band with a white rim, and its name stays readable.
- [ ] Open a collection: the header and grid look the same as the other tabs.
- [ ] Footer is light with dark glyphs.
- [ ] **Library skin** off: the stock Library returns (case bands and the light footer still follow their own options).

**Game page (open any game)**
- [ ] Below the hero art: the same dusk accent sky as the Library (no blurred copy of the art), with a thin accent line right under the hero. Like `expected/game-page.png`.
- [ ] Play: a dark glossy button while unfocused; focused, Steam's green (blue for Install/Update) with a glossy highlight. While a game runs, Stop is a dark key too.
- [ ] Controller and settings buttons: dark glossy keys; focused, silver with an accent ring.
- [ ] Tabs (Activity, Your Stuff, Community, Game Info): selected tab is a silver bar; L1/R1 switch tabs. Scrolled down, the tab row gets the graphite band with the accent line.
- [ ] Activity: the "Say something…" field is recessed and turns white when focused; event cards are dark glossy panels; the date labels are readable.
- [ ] Your Stuff: the achievements panel is a dark card and its progress bar fills with the accent colour. Game Info: the Deck-verified panel is a dark card; links and "Details" are keys that turn silver when focused.
- [ ] Footer is light with dark glyphs.
- [ ] Community tab: cards are dark and rounded with dark author bars; "COMMUNITY GUIDE" labels take a light tint of the accent. Like `expected/game-page-community.png`.
- [ ] Focus on any card (activity, community, screenshots): a white rim with an accent ring around it, instead of Steam's faint pulsing outline.
- [ ] Gear button: the menu sits in a dark box (each submenu level in its own box, overlapping the one before); the focused row is a silver bar with dark text and an accent tab; thin dividers between groups; the page behind is dimmed. Rows Steam colours (e.g. Uninstall, Cancel in red) keep their colour when focused. Like `expected/game-page-menu.png`. The same menu style shows on a capsule's Options menu in the Library.
- [ ] Controller button → controller settings: the same sky; the top section (current layout, View Layout, Edit Layout) is a graphite band with an accent line; View Layout focused is the accent band with a white rim; other buttons and dropdowns are keys that turn silver; Quick Settings rows are dark cards, and the focused row gets the accent strip. The top bar is transparent, with the sky running behind it (no black strip). Like `expected/controller-settings.png`.
- [ ] View Layout: the same sky behind the controller drawing and up under the top bar; section titles (LEFT TRACKPAD, DIRECTIONAL PAD, …) are light; the focused binding is an accent chip with white text. Like `expected/controller-view-layout.png`.
- [ ] Other pages with an opaque top bar (e.g. Settings): the bar is transparent over Steam's usual dark background, so they look as before.
- [ ] **Game page skin** off: the stock game page and controller settings return (menus and the focus ring stay themed).

**Other pages**
- [ ] Downloads: the sky behind the page with an accent line under the active download; rows are dark cards, the focused row gets the accent strip; "Clear All" is a key. Like `expected/downloads.png`.
- [ ] Settings: the sky behind everything, including under the top bar; the left list is a dark panel, the focused page a silver bar with an accent tab, the open page faintly tinted; rows are dark cards with the accent strip on focus; buttons and dropdowns are keys. A game's Properties (gear menu) looks the same.
- [ ] Media: the sky behind the grid, a light rim on each tile, no coloured glow; the focused tile has a white rim and accent ring. Like `expected/media.png`.
- [ ] Friends & Chat (Steam menu): the chat side shows the sky, the friends list is a dark panel; the open tab icon is in the accent; a focused group header is a silver bar with an accent tab; a focused friend gets the accent strip; the message box is recessed. The Quick Access Friends tab gets the same rows and headers.
- [ ] **Other pages** off: Downloads, Settings and Media return to stock (Friends & Chat styling stays, it belongs to Quick Access).

**Options**
- [ ] Background → Silver studio: the spec's original silver look, with dark top-bar icons. The Library turns graphite.
- [ ] Background → Custom image: shows the bundled sample (dimmed in the Library). Copy your own image (JPG or PNG) into `/home/deck/homebrew/themes/`, then choose it under **Wallpaper**.
- [ ] Accent: try a few presets. The sky (Home and Library), bands, Friends badge, focus rings, the Library's tab-strip line, the Steam menu's accent tab and the Quick Access header should all follow. "Custom" shows a colour picker.
- [ ] Ghost channels off/on: the "Store / Library" labels above the pill disappear and reappear.
- [ ] Case bands → By source (default): Steam games read STEAM on a Steam-blue band, Heroic games HEROIC (violet), emulator frontends and emulated games RETRO (grey), other non-Steam apps and launchers APP (graphite). Steam games with custom (SteamGridDB) art still read STEAM. Like `expected/library-case-bands-by-source.png`. After adding a non-Steam game, redeploy (or run `tools/gen_sources.py`) and refresh CSS Loader.
- [ ] Case bands → Steam Deck: the accent band reading STEAM DECK on every capsule. Off: no bands.
- [ ] **NXE scrolling** (on by default): moving right, the focused game is always the left-most one and earlier games slide off to the left; at the end of the list the last game sits at the left, followed by "Go to Library". Check with a game running too. Moving back left brings them back.
- [ ] The focused game is always drawn in front of the next one; each game further back sits behind the one before it.
- [ ] At the end of the list, "View more in your Library" sits on the same receding line as the games before it (not higher).
- [ ] Confirmation dialogs (in a game: Steam button → the game → Exit game; also uninstall and similar): a dark rounded panel with the title on the accent band; the main button is the accent band when focused, Cancel a key that turns silver.
- [ ] Moving left and right, the slide and the depth (games shrinking and rising behind the focused one) happen together in one motion, with no second correcting step. From the first game Steam waits a moment before anything moves; that pause is Steam's.
- [ ] **Carousel depth** (on by default): capsules after the focused one shrink and rise, like `expected/home.png`. Move right through the whole list: the focused capsule stays centred, and capsules don't pile up or vanish near the focus. Turning it off gives flat, equal capsules.

**Performance**
- [ ] Scroll the home carousel quickly, with Carousel depth both off and on. Performance overlay level 1 (QAM → battery tab) shows the frame rate; note any stutter.

### Diagnosing the home tabs from a screenshot

With **Debug outlines** on, the home's tab area prints what the live page contains: "SELECTED TAB: …" under the tab row, and above the footer on the right a block per tab page (its position, transition classes and id) with "HIDDEN BY NXE" on pages the theme hides.

1. On Home, press D-pad down until a news card is focused.
2. Press **R1** once. Note whether the pill moves to FRIENDS.
3. Take a screenshot with **Steam + R1**.

Also try the same with NXE Deck switched off in CSS Loader: if the tabs don't switch there either, it's Steam's own behaviour, not the theme.

## 4. If something breaks

- Turn NXE Deck off in CSS Loader. Everything returns to stock immediately.
- If Quick Access itself is too broken to use: in Desktop Mode, move `/home/deck/homebrew/themes/NXE Deck` out of `themes` (CSS Loader loads every folder in there, whatever its name), then go back to Game Mode. Over SSH: `mv ~/homebrew/themes/"NXE Deck" ~/"NXE Deck.off"`.

## 5. Sending results back

The most useful thing is a probe run, which lists every theme selector and how many live elements it matches:

1. On the Deck: Settings → System → enable Developer Mode, then Settings → Developer → enable **CEF Remote Debugging**. In Decky's settings, also enable **Allow Remote CEF Debugging** (Developer section).
2. With the home screen visible (and Quick Access or the Steam menu open, if you want those tabs captured), run this on the Mac:

   ```bash
   node tools/cdp.mjs deck <deck-ip>
   ```

   It is read-only. It writes a screenshot and a JSON report per tab to `probe-output/`.

   Without the Mac, open `http://<deck-ip>:8081` in any desktop Chromium browser, inspect a tab, and paste `tools/probe.js` into its console.

3. Share `probe-output/` and any screenshots, along with the checklist above.

## Optional: case-band artwork

The "● STEAM DECK" band is drawn in CSS. To replace it with your own artwork:

- **Format:** SVG preferred, because far capsules are scaled down to 55%. Otherwise PNG with transparency.
- **Size:** 5.12 : 1, for example 1024 × 200 px. On screen a band is about 201 × 39 physical pixels at its largest.
- **Content:** white or light artwork on a transparent background. The theme paints the glossy accent band behind it, so it keeps following the accent colour. Keep the mark inside the middle 70% of the width and 60% of the height.
- **Rights:** your own lettering or mark only. No Xbox/Microsoft marks, and not Valve's Steam logo glyph (plain "STEAM DECK" text is fine).
- **File:** `NXE Deck/images/case-band.svg` (or `.png`). CSS can't detect whether a file exists, so the band's CSS then needs a one-line change from text to image.
