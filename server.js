const express = require("express");
const app = express();
app.use(express.json());

const BOT_ID        = process.env.BOT_ID        || "YOUR_BOT_ID";
const KLIPY_KEY     = process.env.KLIPY_KEY     || "YOUR_KLIPY_KEY";
const GROUPME_TOKEN = process.env.GROUPME_TOKEN || "YOUR_GROUPME_TOKEN";
const MAX_GIFS      = 50; // safety cap

const CATEGORIES = {
  sports:   "sports celebration",
  nba:      "NBA basketball",
  nfl:      "NFL football touchdown",
  soccer:   "soccer goal",
  baseball: "baseball home run",
  politics: "politics reaction",
  election: "election vote",
  congress: "congress reaction",
  funny:    "funny fail",
  lol:      "laughing funny",
  wow:      "shocked surprised",
  facepalm: "facepalm",
  clap:     "applause clapping",
  fire:     "fire lit",
  sad:      "sad crying",
  hype:     "hype excited",
  win:      "winning celebration",
  fail:     "epic fail",
  movies:   "movie scene reaction",
  music:    "music dance",
  gaming:   "gaming reaction",
  happy:    "happy dance",
  birthday: "happy birthday",
  weekend:  "weekend vibes",
  monday:   "monday ugh",
  random:   null,
};

const HELP_TEXT = `🎬 GIF BOT COMMANDS
Add a number for multiple GIFs!
!nba 5 = 5 NBA GIFs
!random 10 = 10 random GIFs

!sports !nba !nfl !soccer !baseball
!politics !election !congress
!funny !lol !wow !facepalm !clap
!fire !sad !hype !win !fail
!movies !music !gaming
!happy !birthday !weekend !monday
!random — random GIF
!search <term> <number>
!help — show this list
Max ${MAX_GIFS} GIFs at once`;

// Parse command and count from text like "!nba 5" or "!random10" or "!nba"
function parseCommand(text) {
  const clean = text.trim().toLowerCase();
  // match !command optionally followed by space and/or number
  const match = clean.match(/^!([a-z]+)\s*(\d+)?(.*)$/);
  if (!match) return null;
  const command = match[1];
  const count   = Math.min(parseInt(match[2] || "1", 10), MAX_GIFS);
  const rest    = (match[3] || "").trim();
  return { command, count, rest };
}

async function fetchGifs(query, count) {
  try {
    const q = encodeURIComponent(query);
    const url = `https://api.klipy.com/api/v1/${KLIPY_KEY}/gifs/search?q=${q}&per_page=50`;
    const res  = await fetch(url);
    const data = await res.json();
    const results = data.data?.data || data.data || data.results || [];
    if (results.length === 0) return [];

    // shuffle results so multiple requests give variety
    const shuffled = results.sort(() => Math.random() - 0.5);
    const picked   = shuffled.slice(0, count);

    return picked.map(pick =>
      pick?.file?.hd?.gif?.url ||
      pick?.file?.sd?.gif?.url ||
      pick?.file?.gif?.url     ||
      null
    ).filter(Boolean);
  } catch (err) {
    console.error("fetchGifs error:", err);
    return [];
  }
}

async function fetchRandomGifs(count) {
  const randoms = ["reaction","funny","animals","sports","wow","classic","meme","celebrity"];
  // spread across multiple queries for true variety
  const gifs = [];
  const perQuery = Math.ceil(count / 2);
  for (let i = 0; i < 2 && gifs.length < count; i++) {
    const q = randoms[Math.floor(Math.random() * randoms.length)];
    const batch = await fetchGifs(q, perQuery);
    gifs.push(...batch);
  }
  return gifs.slice(0, count);
}

async function uploadToGroupMe(gifUrl) {
  try {
    const gifRes = await fetch(gifUrl);
    const buffer = await gifRes.arrayBuffer();
    const uploadRes = await fetch("https://image.groupme.com/pictures", {
      method: "POST",
      headers: {
        "Content-Type": "image/gif",
        "X-Access-Token": GROUPME_TOKEN,
      },
      body: buffer,
    });
    const uploadData = await uploadRes.json();
    return uploadData?.payload?.picture_url || uploadData?.payload?.url || null;
  } catch (err) {
    console.error("uploadToGroupMe error:", err);
    return null;
  }
}

async function sendMessage(text) {
  await fetch("https://api.groupme.com/v3/bots/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_id: BOT_ID, text }),
  });
}

async function sendGif(gifUrl) {
  const hostedUrl = await uploadToGroupMe(gifUrl);
  if (!hostedUrl) {
    await sendMessage(gifUrl);
    return;
  }
  await fetch("https://api.groupme.com/v3/bots/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bot_id: BOT_ID,
      text: "",
      attachments: [{ type: "image", url: hostedUrl }],
    }),
  });
}

// Send multiple GIFs with a small delay between each
async function sendGifs(gifs) {
  for (const gif of gifs) {
    await sendGif(gif);
    await new Promise(r => setTimeout(r, 500)); // 500ms between each
  }
}

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  const { text, sender_type } = req.body;
  if (sender_type === "bot") return;
  if (!text || !text.startsWith("!")) return;

  const parsed = parseCommand(text);
  if (!parsed) return;
  const { command, count, rest } = parsed;

  try {
    if (command === "help") {
      await sendMessage(HELP_TEXT);
      return;
    }

    if (command === "random") {
      const gifs = await fetchRandomGifs(count);
      if (gifs.length) await sendGifs(gifs);
      else await sendMessage("Couldn't find any, try again!");
      return;
    }

    if (command === "search") {
      const query = rest;
      if (!query) { await sendMessage("Usage: !search <term> or !search <term> 5"); return; }
      const gifs = await fetchGifs(query, count);
      if (gifs.length) await sendGifs(gifs);
      else await sendMessage(`No results for "${query}"`);
      return;
    }

    if (CATEGORIES[command] !== undefined) {
      const query = CATEGORIES[command] || command;
      const gifs  = await fetchGifs(query, count);
      if (gifs.length) await sendGifs(gifs);
      else await sendMessage(`No GIFs found for !${command}`);
      return;
    }

    await sendMessage("Unknown command. Text !help to see all commands.");
  } catch (err) {
    console.error(err);
    await sendMessage("⚠️ Something went wrong, try again.");
  }
});

app.get("/", (_, res) => res.send("GIF Bot is running ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GIF Bot listening on port ${PORT}`));
