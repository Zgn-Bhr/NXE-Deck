# Selector map

Each element of the design brief (§4–§5; the brief isn't published), the selector the theme uses, and how far it has been verified.

Selectors use readable `module_ClassName` names. CSS Loader rewrites them to Steam's current hashes using `api.deckthemes.com/stable.json`. `python3 tools/check_theme.py` confirms that every name is in that table, that its hash exists in the Steam client installed on this Mac, and that none of the names known to translate to the wrong element are used.

**Status**
- `client`: the element, its classes and its nesting were read from Steam's own CSS and component code in the Mac client (September 2026 build, same gamepad UI as the Deck), and the rule was rehearsed in the emulator (`preview/`).
- `deck`: confirmed on hardware (v0.1 screenshot, 2026-09-29).
- `todo`: no selector yet.

Look up Steam's own rules for any class with `python3 tools/steamcss.py <module_Class>`.

## Findings that shaped the selectors

- **Scale.** The Deck renders its UI at 854×534 CSS px, scaled 1.5× to the panel (measured on hardware: header and footer 60 physical px = Steam's 40). Design px are divided by 1.5, with small text clamped to ~12px.
- **Backslashes.** CSS Loader escapes backslashes after both of its translation passes, so every `\` arrives doubled. Use literal characters; the checker rejects backslashes.
- **Nested `:has()`** is invalid, and inside a forgiving `:is()` it's silently dropped. Focus on a carousel cell is tested with `.gpfocuswithin` (Steam sets it on every nav container around the focus). The checker rejects nested `:has()`.
- **Carousel scrolling** (Kr.Xd over ReactVirtualized): column width = item + 12px; the last column also gets the grid's right padding, read from CSS at mount; focusing column k scrolls to clamp(offset − (C − width)/2, 0, total − C). NXE scrolling undoes this with a transform.
- **Home tab pages** live in a react-transition-group TransitionGroup that keeps the outgoing page (often on top) until its fade-out reports done; on a Deck it never did. Pages are matched to the selected tab via ARIA instead: tabs are `[role=tab][aria-selected][id$=<TabId>]`, pages `[role=tabpanel][id$=<TabId>_Content]` (home tab ids WhatsNew, Friends, Recommended).
- **Home tabs** switch with L1/R1, also from inside the news cards. Steam's bumper glyphs are white images, so they're inverted on the light panel.

- **Steam menu items.** Steam ships two modules with `Item`, `ItemOuter`, `ItemLabel` and `Active` classes. CSS Loader's table maps `mainmenu_Item` to the newer DashboardMenu module, while the Steam-button menu renders the older module's classes. The theme targets items as `.mainmenu_Menu [role="menuitem"]`, a role the menu component sets itself. The checker rejects `mainmenu_Item*` names.
- **Toggles and sliders** are steered through Steam's own mechanisms: the rail's `::before` fill, `--left-track-color`, `--slider-handle-width`, and the knob's `translateX`. They are not repainted.
- **Home capsules.** The wide capsule is the *featured* one (first in the list), not the focused one. Items are ReactVirtualized cells positioned by `left`, and they are siblings. That is what makes B.5 possible.
- **Quick Access rail** sits between the game and the content (first child of a left-to-right row). It stays there, because D-pad navigation assumes it.
- `quickaccessmenu_TabContentColumn` no longer exists in the client.
- **Library.** `GamepadLibrary` paints the background; each tab page scrolls inside it (`TabContentsScroll`), so no fixed attachment is needed. Its tabbed page is always `IsUnderHeader`, so the tab strip's dark frosted `::before` also sits behind the top bar. Grid sections (`appgrid_AppGridSection`) hold a sticky header whose `::after` fades in through `--sticky-header-background-opacity`; at z-index 30 it outranks the tab strip (2) in stock, so a header pushed out by the next one slides over the tabs.

## Shared (`shared.css`, `controls.css`)

| ID | Element | Selector | Status | Notes |
|---|---|---|---|---|
| §1 | Global font | `html, body, body *` | client | Motiva Sans kept as fallback for non-Latin glyphs |
| D.4 | Slider size | `.gamepadslider_SliderControl` | client | Sets `--slider-handle-width: 28px` so Steam's thumb maths stays right |
| D.4 | Slider track + fill | `.gamepadslider_SliderTrack`, `…::before` | client | Fill colour via `--left-track-color` |
| D.4 | Slider thumb | `.gamepadslider_SliderHandle` | client | Focus: `.gamepadslider_SliderControlAndNotches.gpfocus` |
| D.5 | Toggle | `.gamepaddialog_Toggle` | client | The separate `toggle_*` module is not used by the gamepad UI |
| D.5 | Toggle fill | `.gamepaddialog_ToggleRail::before` | client | Slides in with `translateX` |
| D.5 | Toggle knob | `.gamepaddialog_ToggleSwitch` | client | On: `translateX(24px)` |

## C: Steam menu (`mainmenu.css`, tab `MainMenu`)

| ID | Element | Selector | Status | Notes |
|---|---|---|---|---|
| C.2 | Panel | `.mainmenu_Menu` | deck | The menu is its own 240×534 window; the panel keeps Steam's 240px (the design's 400 design px overflowed it and made the menu scroll sideways). Full height, list from 52px |
| C.2 | Closed position | `.mainmenu_Menu:not(.mainmenu_Open)` | client | `translateX(calc(-100% - 44px))`, clears the shadow |
| C.1 | Gamercard band | — | dropped | Removed in v0.7.3 at the user's request |
| C.3 | Item wrapper | `.mainmenu_Menu div:has(> [role='menuitem'])` | client | Stock is fixed at 240px and clips |
| C.3 | Item | `.mainmenu_Menu [role='menuitem']` | client | Stock scales active/focused items to 1.1; reset |
| C.3 | Icon / label | `[role='menuitem'] > :nth-last-child(2)` / `> :last-child` | client | Children: [active dot], icon, label |
| C.4 | Focused item | `[role='menuitem'].gpfocus` | deck | Plus an accent tab (`::before`) inside the bar's left edge; the item is `position: relative` |
| — | Current page | `[role='menuitem']:has(> [style*='height: 50%'])` | client | Steam's active dot (inline-styled child) is hidden: it doesn't follow the selection. The row keeps a faint tint |
| C.5 | Divider above Power | last item wrapper `::before` | client | |
| C.7 | Folded menu (in-game) | `.mainmenu_Menu.mainmenu_Collapsed` (+ items centred, label hidden) | deck | 44px strip next to the game's panel |
| C.8 | In-game panel | `._xfZ18oWU_ScrollMask._xfZ18oWU_Visible`, `…NavigationColumn(::before)`, `…NavigationMenuItem(.gpfocus, ._xfZ18oWU_Active)`, `…ActiveDot`, `…AppColumn(._xfZ18oWU_FocusedColumn)` | deck | Module mainmenuapprunning; only generated names exist. Read live while a game ran |
| C.6 | Scrim | — | todo | Don't style the MainMenu `body` |

## D: Quick Access (`quickaccess.css`, tab `QuickAccess`)

| ID | Element | Selector | Status | Notes |
|---|---|---|---|---|
| D.1 | Panel | `.quickaccessmenu_QuickAccessMenu` | client | Steam paints the panel here, not on `Menu` |
| D.2 | Header band | `.quickaccessmenu_Title` | client | Also Decky plugin titles. Replaces Steam's 12px dark halo |
| D.3 | Rail | `.quickaccessmenu_Tabs` | client | |
| D.3 | Rail tab / selected | `.quickaccessmenu_Tab`, `.quickaccessmenu_Selected` | client | Width and height left to Steam; no overhang (the rail can scroll-clip) |
| D.6 | Section title | `.quickaccessmenu_PanelSectionTitle` | client | |
| D.6 | Row label / icon | `.quickaccessmenu_TabGroupPanel .gamepaddialog_FieldLabel` / `…FieldIcon` | client | |
| D.6 | Focused row | `…TabGroupPanel .gamepaddialog_Field.gamepaddialog_HighlightOnFocus:is(.gpfocus, .gpfocuswithin)` | client | Stock flat #3d4450 → accent strip; none behind a focused button (`:has(.DialogButton.gpfocus)`). Structure read live from a Deck over CEF |
| D.8 | Buttons | `…TabGroupPanel .DialogButton` (+ `.gpfocus`, `.Primary`, `.Destructive`) | client | Steam's and every Decky plugin's (plugin list, CSS Loader). `DialogButton`, `Primary`, `Destructive` are unhashed |
| D.8 | Header-band buttons | `.quickaccessmenu_Title .DialogButton` | client | Decky renders its title (with store/settings buttons) inside the panel |

## B: Home (`home.css`, `options/*.css`, tab `bigpicture`)

Dark-ink rules are all scoped under `.gamepadhome_ScrollArea`, the element that paints the silver, so a miss falls back to Steam's white-on-dark.

| ID | Element | Selector | Status | Notes |
|---|---|---|---|---|
| B.1 | Background | `.gamepadhome_ScrollArea` | deck | Horizon = `--nxe-horizon`, set by the "Floor line" slider |
| B.1 | Stock art + glow | `…RecentGamesBackgroundContainer`, `…CarouselCapsuleBackgroundGlow` | deck | |
| B.2 | Ghost labels | `…RecentGamesHeaderLabel::before/::after` | deck | `options/ghost.css` |
| B.3 | Header pill | `.gamepadhomerecentgames_RecentGamesHeaderLabel` | deck | Stock fades it out after 8s; kept visible |
| B.4 | Featured capsule | `.appportrait_LibraryItemBox.appportrait_InRecentGames.appportrait_Landscape` | client | |
| B.4 | Focused capsule | `…InRecentGames:is(.gpfocus, :focus)` | deck | White rim + accent ring |
| B.5 | Reflection | `.appportrait_LibraryItemBox.appportrait_InRecentGames` | deck | Inner scroll container set to `overflow: visible` so it isn't cropped |
| B.5 | Front-to-back stacking | depth anchor `{z-index}` chain | client | Focused cell on top, each step back one lower |
| B.5 | Shrink by distance | `…innerScrollContainer > * { view-timeline: --nxe-col inline }`, capsule and column animations on that timeline | client | `options/depth.css` (`tools/gen_depth.py`). Scroll-driven since v0.9.3: Steam moves the focus only after its 120ms scroll, so focus-keyed depth lagged. Focused column = `cover 50% - 2.8vw` (Steam centres ignoring the carousel's left padding). Unfocused carousel: the old featured-anchored rules |
| B.5 | NXE scrolling | `…innerScrollContainer:has(.gpfocus) > *` (constant transform), start-of-list `margin-left` rules, left fade on the view timeline | client | `options/scroll.css` (`tools/gen_scroll.py`). The focused column is kept centred in layout (Steam's scroll, or margins where it can't scroll); margins, unlike transforms, move the view timeline. Measured frame by frame in the emulator |
| — | Go to Library tile | `…BasicGameCarouselItem .basicgamecarousel_TextBoxCarouselContents` | client | Silver glossy tile |
| B.6 | Case bands | `…InRecentGames.appportrait_Portrait::before` | deck | Selector matched; text fixed in v0.2 (literal characters) |
| B.7 | NEW TO LIBRARY | `.appportrait_AppPortraitBanner` | client | |
| B.8 | Title / meta | `.basicgamecarousel_CarouselGameLabel`, `…_SubMessage` | deck | Dropped 28px with `translate` so Steam's own animation keeps running |
| B.9 | Lower band | `.gamepadhome_TabbedContent .gamepadtabbedpage_GamepadTabbedPage` | deck | `TabbedContent` itself has height 0; its −30px pull-up removed |
| B.9 | Scrolled tab row | `…TabHeaderRowWrapper::before` | client | Stock dark glass → light glass |
| B.10 | Tabs / badge | `…gamepadtabbedpage_Tab`, `…TabCountBadge` | deck | Steam already centres them |
| B.10 | L1/R1 glyphs | `…TabbedContent .gamepadtabbedpage_Glyphs img` | client | Inverted, kept at 55% until the row is focused |
| B.11 | News card | `.gamepadhomewhatsnew_EventPreviewContainer` | client | Category label sits above it in the stock layout |
| B.11 | Category label | `.gamepadhomewhatsnew_EventType`, `…EventType28` | client | 28 = News |
| B.11 | Title / date | `.gamepadhomewhatsnew_Title`, `…EventInfo > :first-child` | client | `EventSummary` left alone (Steam's focus overlay) |
| B.10 | Tab page switching | `…GamepadTabbedPage:has([role=tab][aria-selected=true][id$=Friends]) [role=tabpanel]:not([id$=Friends_Content])` (per tab) | client | Hides pages that aren't the selected tab's; the selected page slides in with its own animation |
| B.10 | Friends / Recommended | `…TabbedContent :is(.gamepadhomefriends_FriendsHeader, …)`, tiles `…FavoriteFriend, …GoToFriends, …InGameGame` | client | Stock is white on translucent tiles; headers dark, tiles dark glossy |
| B.12 | Top bar | `body:has(.gamepadhome_ScrollArea) .header_Header` | deck | White on the green sky (Steam's own); dark ink only with Silver studio (`options/bg-silver.css`) |
| B.13 | Footer | `body:has(.gamepadhome_ScrollArea) .footer_BasicFooter` | deck | `options/footer.css`, on by default; glyphs inverted |

## Library (`library.css`, `options/*.css`, tab `bigpicture`)

Not in the design handoff; extends the Home look. "Library skin" option, on by default.

| ID | Element | Selector | Status | Notes |
|---|---|---|---|---|
| L.1 | Background | `.gamepadlibrary_GamepadLibrary` | client | `--nxe-library-bg`: the accent sky at dusk, no floor or bokeh; graphite with Silver studio, dimmed wallpaper with Custom image |
| L.1 | Collections background | `…GamepadLibrary .allcollections_ScrollContainer` | client | Stock dark gradient made transparent |
| L.1 | Focus glow | `.appgrid_LibraryImageBackgroundGlow` | client | Hidden (50px blur of the art) |
| L.2 | Tab strip | `…GamepadLibrary .gamepadtabbedpage_TabHeaderRowWrapper(::before)` | client | Graphite band with an accent line; raised above the sticky section headers |
| L.2 | Tabs | `…GamepadLibrary .gamepadtabbedpage_Tab` | client | Selected = silver bar, focus = accent ring |
| L.3 | Capsules | `…GamepadLibrary .appportrait_LibraryItemBox` | client | Rim and shadow, no reflection; focus rings drawn outside (box-shadow), since an inset outline can sit under the art |
| L.3 | Case bands | `…GamepadLibrary .appportrait_LibraryItemBox.appportrait_Portrait::before` | client | `options/bands.css`; label/colour/ink from `--nxe-band-*` |
| L.3 | Band source | `.appportrait_LibraryItemBox:has(img[src*="/customimages/<id>p."])` (generated), `:has(img[src*="/images/defaultappimage"])` | deck | Capsule art addresses read live: Steam `/assets/<appid>/…` or the store CDN; shortcuts and SteamGridDB art `/customimages/<id>p.png` (shortcut IDs are 10 digits, Steam's 5–7), so shortcut IDs come from `shortcuts.vdf` (`appid & 0xFFFFFFFF`) |
| L.4 | Section headers | `.appgrid_AppGridSectionLabel`, `…AppGridSectionHeader::after`, `.appgrid_Rule` | client | Band: graphite with an accent line. By Steam's fade formula (offset from the scroller's top, not its content edge) the band may never show under this page's 98px top padding; the label has a shadow for that case |
| L.4 | Filter bar | `.gamepadlibrary_AppGridFilterHeader(AsButton)`, `…AppGridFilterText` | client | |
| L.5 | Collection tiles | `.allcollections_Collection`, `…CollectionLabel`, `.allcollections_Header` | client | Dark glossy panels; focused = deep accent band |
| L.6 | Footer | `body:has(.gamepadlibrary_GamepadLibrary) .footer_BasicFooter` | client | `options/footer.css` |

## Game page (`appdetails.css`, tab `bigpicture`)

Not in the design handoff; extends the Library look. "Game page skin" option, on by default. Structure read live from a Deck over CEF (October 2026).

| ID | Element | Selector | Status | Notes |
|---|---|---|---|---|
| G.1 | Background | `.appdetails_Container .appdetails_ScrollContainer` | client | `--nxe-library-bg`; the scroller's background stays put while the hero scrolls |
| G.1 | Blurred hero copy | `.sharedappdetailsheader_ImgBlurBackdrop` | client | Hidden (Steam: flipped, 20% opacity copy of the hero under the header) |
| G.1 | Under-hero line | `.basicappdetailssectionstyler_AppDetailsRoot` | client | Steam's dark wash removed; inset accent line + shadow |
| G.2 | Play button | `…AppActionButton` (container), `.appactionbutton_ButtonChild:is(.gpfocus, :focus)` | client | Gloss via `background-image` only, so Steam's state colour (green Play, blue others) stays |
| G.2 | Side buttons | `:is(.appdetailsplaysection_MenuButton, .appactionbutton_ShutdownAppButton)` | client | Keys; silver + accent ring when focused |
| G.3 | Tabs | `…appdetails_Container .gamepadtabbedpage_Tab`, `…TabHeaderRowWrapper::before` | client | As in the Library |
| G.4 | Activity | `.appactivityday_AppActivityDate`, `.appactivityday_Rule`, `.appactivityday_PartnerEvent (> [role=button])` | client | Card focus is Steam's focus-ring overlay, left alone |
| G.4 | Post field | `.posttextentry_PostTextEntryArea:not(:focus)` | client | Recessed; Steam's white focus kept |
| G.5 | Panels | `.appdetailsachievementssection_InnerContainer`, `.appdetailssection_Highlight`, `…RightColumnSection`, `.appdetailsgameinfopanel_DeckVerifiedInfo` | client | Not in the snapshot (other tabs); from Steam's CSS |
| G.5 | Achievement bars | `…AchievementProgressContainer`, `…SingleAchievementProgressBar`, `…AchievementProgress` | client | Accent fill |
| G.6 | Buttons | `.appdetailsprimarylinkssection_Anchor`, `.appdetailsgameinfopanel_Details`, `.DialogButton` | client | Keys; silver when focused |
| G.6 | Scroll To Top | `.smartscrollcontainer_ScrollToTopButton > div` | client | Accent band |
| G.4 | Community cards | `.appdetailscommunityfeed_CommunityItem`, `…ArtItem .appdetailscommunityfeed_BottomSection`, `…GuideTitle`, `…LoadContentButton` | client | From Steam's CSS; focus is Steam's focus ring (M.2) |
| G.7 | Footer | `body:has(:is(.appdetails_Container, .controllerconfigurator_ControllerConfiguratorMain)) .footer_BasicFooter` | client | `options/footer.css` |
| G.8 | Controller settings | `.controllerconfigurator_ControllerConfiguratorGamepadPage` (sky, full page incl. under the top bar), `.controllerconfigurator_ControllerConfiguratorMain` (+ `TopSection`, `BottomSection`, `.gamepaddialog_Field`, `.DialogButton`) | deck | Read live from a Deck; `preview/controller.html` is a sanitized snapshot |
| G.9 | View Layout | `.gamepadpage_GamepadPage:has(.controllerconfiguratorsummary_ControllerConfiguratorSummary:not(SmallPreview, MainMenu))`, `…DirectAccessButton:is(:focus, .gpfocus)`, `…ControlsListSection .controllerconfiguratorsummary_Title`, `…ConfigButton` | client | From Steam's code: GamepadPage (padForHeader, opaque header) > FlexColumn > Summary. Controller drawing is Steam's image, untouched |

## Menus and focus (`dialogs.css`, tabs `bigpicture`, `QuickAccess`, always on)

| ID | Element | Selector | Status | Notes |
|---|---|---|---|---|
| M.1 | Context menu panel | `.gamepadcontextmenu_contextMenuContents` (each level's row list), `.gamepadcontextmenu_contextMenu` | deck | The Deck's gamepad menu has no panel element (v0.7.1 styled `contextMenu` and showed no box). Its row list carries 15/40px first/last-row scroll margins, zeroed. CSS Loader maps these names to module 6276, the one the BasicUI menu renders |
| M.1 | Rows | `.gamepadcontextmenu_contextMenuItem` (`:not(.Focused, .active)` transparent) | client | Focused rows keep Steam's fill (white, or green/blue/red by meaning) under a gloss, plus an accent tab |
| M.1 | Dividers, header, scrim | `.gamepadcontextmenu_ContextMenuSeparator`, `…BasicContextMenuHeader`, `…contextMenuFade` | client | Scrim per spec C.6 |
| M.2 | Focus ring | `.focusring_FocusRing` | client | Steam's generic focus overlay (cards, screenshots): white rim + accent ring |
| M.4 | Achievements fold | `.achievementspage_AchievementTabs .gamepadtabbedpage_GamepadTabbedPage` (fit), `…TabContentsScroll { scroll-timeline }`, `div:has(> .achievementspage_HeaderContainer) { timeline-scope }`, `.achievementspage_HeaderContainer { animation-timeline }` | deck | Read live in-game. Header needs `flex-shrink: 0` once it has `overflow: hidden`. The Steam-menu window leaves `--basicui-header-height` unset |
| M.5 | Confirmation dialog | `.gamepaddialog_ModalPosition > .gamepaddialog_GamepadDialogContent` (+ `.DialogHeader:first-child`, `.DialogBodyText`, `.DialogButton`) | deck | From Steam's CSS (box: #0e141b, 2px #23262e border, 660px). Confirmed by the user on the "Exit game" dialog (v0.9.4) |
| M.3 | Opaque top bar | `.header_Header.header_HeaderOpaque` | deck | Steam paints it #000 on pages that request `headerVisibility: "opaque"` (controller settings, View Layout, …); transparent here |

## Other pages (`pages.css`, tab `bigpicture`; Friends in `quickaccess.css`)

All read live from a Deck (October 2026); "Other pages" option, on by default.

| ID | Element | Selector | Status | Notes |
|---|---|---|---|---|
| P.1 | Downloads | `.downloads_DownloadsPage` (+ `TopBar`, `SectionTitle`, `Rule`, `SectionItem`, `SectionItemWrapper:is(.gpfocus, .gpfocuswithin)`, `.DialogButton`) | deck | The small per-row buttons keep Steam's focus colours (blue/green by action) |
| P.2 | Settings | `.gamepadpagedsettings_PagedSettingsDialog` (full screen, under the top bar) + `…PageListColumn`, `…PageListItem`, `.gamepaddialog_Field`, `.DialogButton`, `.SettingsDialogSubHeader` | deck | Same dialog for game Properties. Page list items are `role=tab` |
| P.3 | Media | `.gamepadui_BasicHome:has(._mP9RJOCZ_ScreenshotList)` (sky on the app root), `._wEPhzApt_BackgroundImageGlow`, `._wEPhzApt_ListItem` | deck | Only CSS Loader's generated names exist for these; no styles in the Mac client. Focus is the focus ring (M.2) |
| P.4 | Friends & Chat | `.FriendsListAndChatsSteamDeck:has(> .SteamDeckChats:not(.SteamDeckChatsHidden))` (wide view), `.friendlist`, `.FriendsListTab.Active`, `.friendGroup .groupName.gpfocus`, `.friend.gpfocus`, `.chatentry_chatEntryControls` | deck | The QuickAccess window, wide; unhashed global classes (checker allow-list) |

