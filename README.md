# Maple's Clues

A two-player online deduction card game for phones (Android and iOS).

## Rules

- 49 cards. Each card has an **animal**, an **accessory** and a **location** (7 of each). Every animal, accessory and location appears on exactly 7 cards, and no two cards share more than one attribute.
  - Animals: Maple (the British brown cat), Dog, Rabbit, Owl, Fox, Turtle, Elephant
  - Accessories: Top hat, Glasses, Scarf, Bow tie, Backpack, Crown, Umbrella
  - Locations: Beach, Forest, Kitchen, Park, Library, Mountain, Garden
- Each player has 5 visible cards in hand and 1 **hidden card**. You can't see your own hidden card, but your opponent can, and you can see theirs.
- On your turn, play a hand card into your opponent's **Similar (דומה)** pile if it shares at least one attribute with their hidden card, or into their **Not similar (לא דומה)** pile if it shares none. The server checks your choice and rejects a wrong one; the card stays in your hand and you try again. After a valid play you draw a card.
- **Personal clue piles:** each player has their own Similar and Not similar piles (4 piles in total). A clue about your hidden card goes into *your* piles.
- **Guessing:** 3 guesses per game, at most 1 per turn, made before you play your clue. Correct = you win. A wrong guess means you still play a clue that turn. Three wrong guesses = you lose.
- When the deck is empty, keep playing from your hand. If both hands run out with no winner, the game is a draw.

## Run locally

```
npm install
npm start          # http://localhost:3000
npm test           # 23 tests: game rules, clue-pile routing, refresh/reconnect/restart
```

## Deploy on Render (free)

1. Push this folder to a GitHub repository.
2. On https://render.com choose **New → Blueprint** and pick the repository. `render.yaml` sets everything up.
3. Open the `https://<name>.onrender.com` URL on both phones. One player taps **Create a new game** and shares the invite link.

On the free plan the server sleeps after about 15 minutes with no visitors, and the first visit takes about 30–60 seconds to wake it. Games are saved to `data/games.json`, so they survive refreshes and reconnects. Render's free disk is wiped when the service restarts or redeploys, so unfinished games are lost at that point.

## Project layout

- `src/cards.js`: card definitions and the similarity rule (shared with the browser)
- `src/game.js`: game rules, clue routing and validation, per-player views
- `src/store.js`: game persistence
- `src/server.js`: HTTP and WebSocket server
- `public/`: mobile web client: `arena.js` (shared duel field and card animations), `art.js` (SVG card illustrations), `ui.js` (card helpers), `app.js` (screens, networking, menus)
- `test/`: automated tests
