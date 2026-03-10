const express = require("express");
const app = express();
app.use(express.json());

// ── CONFIG ── set these in Glitch .env or paste directly ──────────────────────
const BOT_ID     = process.env.BOT_ID     || "YOUR_BOT_ID";
const TENOR_KEY  = process.env.TENOR_KEY  || "YOUR_TENOR_API_KEY";
// ─────────────────────────────────────────────────────────────────────────────

// Category aliases  →  Tenor search term
const CATEGORIES = {
  // Sports
  sports:     "sports celebration",
  nba:        "NBA basketball",
  nfl:        "NFL football touchdown",
  soccer:     "soccer goal",
  baseball:   "baseball home run",
  // Politics
  politics:   "politics reaction",
  election:   "election vote",
  congress:   "congress reaction",
  // Reactions / moods
  funny:      "funny fail",
  lol:        "laughing funny",
  wow:        "shocked surprised",
  facepalm:   "facepalm",
  clap:       "applause clapping",
  fire:       "fire lit",
  sad:        "sad crying",
  hype:       "hype excited",
  win:        "winning celebration",
  fail:       "epic fail",
  // Pop culture
  movies:     "movie scene reaction",
  music:      "music dance",
  gaming:     "gaming reaction",
  // Holidays / misc
  happy:      "happy dance",
  birthday:   "happy birthday",
  weekend:    "weekend vibes",
  monday:     "monday ugh",
  random:     null,   // handled specially
};

const HELP_TEXT = `🎬 GIF BOT COMMANDS
Send any of these:
!sports !nba !nfl !soccer !baseball
!politics !election !congress
!funny !lol !wow !facepalm !clap
!fire !sad !hype !win !fail
!movies !music !gaming
!happy !birthday !weekend !monday
!random  — totally random GIF
!search <anything>  — custom search
Type !help to see this again`;

// ── Tenor API ─────────────────────────────────────────────────────────────────
async function fetchGif(query) {
  const q = encodeURIComponent(query);
  const url = `https://tenor.googleapis.com/v2/search?q=${q}&key=${TENOR_KEY}&limit=20&media_filter=gif`;
  const res  = await fetch(url);
  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;
  // pick a random result from top 20
  const pick = data.results[Math.floor(Math.random() * data.results.length)];
  return pick.media_formats?.gif?.url || pick.url;
}

async function fetchRandom() {
  const randoms = ["reaction","funny","animals","sports","wow","classic"];
  const q = randoms[Math.floor(Math.random() * randoms.length)];
  return fetchGif(q);
}

// ── GroupMe sender ────────────────────────────────────────────────────────────
async function sendMessage(text) {
  await fetch("https://api.groupme.com/v3/bots/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_id: BOT_ID, text }),
  });
}

// Attach a picture URL — GroupMe renders GIF URLs as images inline
async function sendGif(gifUrl, caption) {
  const body = { bot_id: BOT_ID, text: caption || "" };
  // GroupMe accepts a picture_url attachment
  body.attachments = [{ type: "image", url: gifUrl }];
  await fetch("https://api.groupme.com/v3/bots/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Webhook ───────────────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);                          // ack immediately
  const { text, sender_type } = req.body;
  if (sender_type === "bot") return;            // ignore own messages
  if (!text || !text.startsWith("!")) return;  // only handle !commands

  const parts   = text.trim().toLowerCase().split(/\s+/);
  const command = parts[0].slice(1);            // strip the !

  try {
    if (command === "help") {
      await sendMessage(HELP_TEXT);
      return;
    }

    if (command === "random") {
      const gif = await fetchRandom();
      if (gif) await sendGif(gif, "🎲 Random GIF!");
      else await sendMessage("Couldn't find one, try again!");
      return;
    }

    if (command === "search") {
      const query = parts.slice(1).join(" ");
      if (!query) { await sendMessage("Usage: !search <your query>"); return; }
      const gif = await fetchGif(query);
      if (gif) await sendGif(gif, `🔍 ${query}`);
      else await sendMessage(`No results for "${query}"`);
      return;
    }

    if (CATEGORIES[command] !== undefined) {
      const query = CATEGORIES[command] || command;
      const gif   = await fetchGif(query);
      if (gif) await sendGif(gif, `!${command}`);
      else await sendMessage(`No GIFs found for !${command}`);
      return;
    }

    // unknown command
    await sendMessage(`Unknown command. Text !help to see all commands.`);

  } catch (err) {
    console.error(err);
    await sendMessage("⚠️ Something went wrong, try again.");
  }
});

app.get("/", (_, res) => res.send("GIF Bot is running ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GIF Bot listening on port ${PORT}`));
