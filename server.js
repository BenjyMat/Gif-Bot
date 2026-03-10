const express = require("express");
const app = express();
app.use(express.json());

const BOT_ID    = process.env.BOT_ID    || "YOUR_BOT_ID";
const KLIPY_KEY = process.env.KLIPY_KEY || "YOUR_KLIPY_KEY";

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
!sports !nba !nfl !soccer !baseball
!politics !election !congress
!funny !lol !wow !facepalm !clap
!fire !sad !hype !win !fail
!movies !music !gaming
!happy !birthday !weekend !monday
!random — totally random GIF
!search <anything> — custom search
!help — show this list`;

async function fetchGif(query) {
  try {
    const q = encodeURIComponent(query);
    const url = `https://api.klipy.com/api/v1/${KLIPY_KEY}/gifs/search?q=${q}&per_page=20`;
    console.log("KLIPY URL:", url);
    const res  = await fetch(url);
    const data = await res.json();
    console.log("KLIPY RAW:", JSON.stringify(data).slice(0, 800));

    const results = data.data || data.results || data.gifs || [];
    if (results.length === 0) return null;

    const pick = results[Math.floor(Math.random() * results.length)];
    console.log("PICK:", JSON.stringify(pick).slice(0, 400));

    return (
      pick?.files?.gif?.url          ||
      pick?.files?.fixed_height?.url ||
      pick?.media_formats?.gif?.url  ||
      pick?.gif?.url                 ||
      pick?.url                      ||
      null
    );
  } catch (err) {
    console.error("fetchGif error:", err);
    return null;
  }
}

async function fetchRandom() {
  const randoms = ["reaction","funny","animals","sports","wow","classic"];
  const q = randoms[Math.floor(Math.random() * randoms.length)];
  return fetchGif(q);
}

async function sendMessage(text) {
  await fetch("https://api.groupme.com/v3/bots/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_id: BOT_ID, text }),
  });
}

async function sendGif(gifUrl, caption) {
  await fetch("https://api.groupme.com/v3/bots/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bot_id: BOT_ID,
      text: caption || "",
      attachments: [{ type: "image", url: gifUrl }],
    }),
  });
}

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  const { text, sender_type } = req.body;
  if (sender_type === "bot") return;
  if (!text || !text.startsWith("!")) return;

  const parts   = text.trim().toLowerCase().split(/\s+/);
  const command = parts[0].slice(1);

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
    await sendMessage("Unknown command. Text !help to see all commands.");
  } catch (err) {
    console.error(err);
    await sendMessage("⚠️ Something went wrong, try again.");
  }
});

app.get("/", (_, res) => res.send("GIF Bot is running ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GIF Bot listening on port ${PORT}`));
