# Season 2 across Bloqvia

- Add the two season cards and roads to the map, preserving all existing inventory, daily quests, streak, shop controls and block pills.
- Connect chapters 04–06 to the existing quiz and Ask Bloq experience; use only the supplied chain data and Bloq movement APIs.
- Add the Season 2 stamp to the existing Passport card without replacing any fields, plus season progress rows and the map’s stamp celebration.
- Update Reveal’s completed-chapter steps and journey buttons, the landing continuation line, and chapter transaction titles.
- Verify mobile and desktop layouts, available testnet flows, reduced motion and untouched protected folders; report unavailable checks explicitly.

## Technical details
- Add only `stamps` to the game Passport type and an empty stamp list to the mock.
- Keep Season 2 start persistence browser-only and guarded by try/catch; delay trail progress until the quiz closes.
- The third chapter’s existing completion transaction supplies the stamp; no additional chain action, reward, price or balance logic.
- Keep existing routes and metadata, use CSS tokens for the new season surfaces, and add focused tests for founding/chapter progress and stamped MRZ values.