const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
} = require("discord.js");
const fs = require("fs");
const Fuse = require("fuse.js");
const path = require("path");
const Papa = require("papaparse");

eval(fs.readFileSync("./public/utils/tournamentutils.js") + "");

const archiveFolder = path.join(
  __dirname,
  "..",
  "..",
  "utils",
  "archiveData"
);
const tracksCsvPath = path.join(archiveFolder, "RtVGMPrevious.csv");

module.exports = {
  data: (() => {
    return new SlashCommandBuilder()
      .setName("generate-playlist")
      .setDescription(
        "Generate a YouTube playlist with random tracks from our archives!"
      )
      .addStringOption((option) =>
        option
          .setName("submitter")
          .setDescription("Filter by submitter (type to search)")
          .setAutocomplete(true)
      )
      .addStringOption((option) =>
        option
          .setName("series")
          .setDescription("Filter by series/game (type to search)")
          .setAutocomplete(true)
      )
      .addBooleanOption((option) =>
        option
          .setName("make-public")
          .setDescription("Choose to post the result publicly")
      );
  })(),

  async execute(interaction) {
    const seriesSearch = interaction.options.getString("series");
    const submitter = interaction.options.getString("submitter");
    const makePublic = interaction.options.getBoolean("make-public") ?? false;

    await interaction.reply({
      content: "🎶 Fetching...",
      ephemeral: !makePublic,
    });

    await handleTrackFetch(
      interaction,
      seriesSearch,
      submitter,
      makePublic,
      true
    );
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const query = String(focused.value || "").toLowerCase();
    let options = [];

    if (focused.name === "submitter") {
      const submitterNames = getSubmitterNames();
      const matches = query
        ? submitterNames.filter((name) =>
            name.toLowerCase().includes(query)
          )
        : submitterNames;
      options = matches.map((name) => ({ name, value: name }));
    } else if (focused.name === "series") {
      const seriesNames = getSeriesNames();
      let matches = seriesNames;
      if (query) {
        const fuse = new Fuse(seriesNames, { threshold: 0.2 });
        matches = fuse.search(query).map((result) => result.item);
      }
      options = matches.map((name) => ({ name, value: name }));
    } else {
      return interaction.respond([]);
    }

    const choices = options.slice(0, 25).map((opt) => ({
      name: opt.name.slice(0, 100),
      value: opt.value,
    }));

    return interaction.respond(choices);
  },
};

// Main track handling
async function handleTrackFetch(
  interaction,
  seriesSearch,
  submitter,
  makePublic,
  useEditReply = false
) {
  let allTracks = [];
  if (fs.existsSync(tracksCsvPath)) {
    allTracks = loadTracksFromCsv(tracksCsvPath);
  }

  if (allTracks.length === 0) {
    return await interaction.editReply({
      content: "No tracks are available to build a playlist right now.",
      embeds: [],
      compontens: [],
      ephemeral: !makePublic,
    });
  }

  // filter by series if requested
  const fuse = new Fuse(allTracks, { keys: ["Source"], threshold: 0.2 });
  let matches = seriesSearch
    ? fuse.search(seriesSearch).map((r) => r.item)
    : allTracks;

  // filter by submitter if requested
  if (submitter) {
    const submitterFuse = new Fuse(matches, {
      keys: ["Nominator"],
      threshold: 0.2,
    });
    matches = submitterFuse.search(submitter).map((r) => r.item);
  }

  if (matches.length === 0) {
    return await interaction.editReply({
      content: seriesSearch
        ? `No results found for series "${seriesSearch}" with selected options.`
        : "Could not find any tracks with selected options.",
      embeds: [],
      compontens: [],
      ephemeral: !makePublic,
    });
  }

  // 5) BVGM# lookup or final random from `tracks` array
  const validTracks = matches.filter((r) => r["URL"]);

  // Shuffle and remove duplicates based on YouTube URL
  const uniqueTracksMap = new Map();
  for (const track of validTracks) {
    const id = extractVideoId(track["URL"]);
    if (id && !uniqueTracksMap.has(id)) {
      uniqueTracksMap.set(id, track);
    }
  }

  // Get first 10 from the shuffled set
  const uniqueTracks = Array.from(uniqueTracksMap.values());

  // Shuffle the unique list
  for (let i = uniqueTracks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniqueTracks[i], uniqueTracks[j]] = [uniqueTracks[j], uniqueTracks[i]];
  }

  const selectedTracks = uniqueTracks.slice(0, 10);

  if (selectedTracks.length === 0) {
    return await interaction.editReply({
      content: "Could not find enough unique tracks with selected options.",
      embeds: [],
      compontens: [],
      ephemeral: !makePublic,
    });
  }

  return await paginateSeriesResults(
    interaction,
    selectedTracks,
    seriesSearch,
    makePublic,
    submitter
  );
}

function extractVideoId(url) {
  try {
    const u = new URL(url);
    // If ?v= param
    if (u.searchParams.has("v")) {
      const vid = u.searchParams.get("v");
      if (vid && vid.length === 11) return vid;
    }
    // Short youtu.be/
    const short = u.pathname.match(/^\/([\w-]{11})$/);
    if (u.hostname.includes("youtu.be") && short) {
      return short[1];
    }
    // Embed
    const embed = u.pathname.match(/embed\/([\w-]{11})/);
    if (embed) return embed[1];
  } catch (e) {
    // fallback: try regex for really malformed links
    const match = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
    if (match) return match[1];
  }
  return null;
}

async function paginateSeriesResults(
  interaction,
  matches,
  seriesSearch,
  makePublic,
  submitter = null
) {
  const videoIds = matches
    .map((t) => extractVideoId(t["URL"]))
    .filter(Boolean);

  const playlistUrl = `https://www.youtube.com/watch_videos?video_ids=${videoIds.join(
    ","
  )}`;

  let page = 0;
  const itemsPerPage = 10;
  const totalPages = Math.ceil(matches.length / itemsPerPage);

  const generateEmbed = (page) => {
    const start = page * itemsPerPage;
    const slice = matches.slice(start, start + itemsPerPage);
    console.log(slice);
    const lines = slice.map((t, i) => {
      const idx = start + i + 1;
      const url = t["URL"];
      const title = t["Song"] || "Unknown";
      const game = t["Source"] || "Unknown Game";
      const who = t["Nominator"] || "Unknown";
      return `${idx}. ${url ? `[${title}](${url})` : title} – ${game} | ${who}`;
    });

    const headerParts = [];
    if (submitter) headerParts.push(submitter);
    if (seriesSearch) headerParts.push(seriesSearch);
    const title = `🎵 Contents: ${headerParts.join(" – ")}`;

    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(
        "────────────────────────────\n" +
          lines.join("\n") +
          "\n────────────────────────────"
      )
      .setColor(0x09c309)
      .setFooter({
        text: "Playlists can be accessed via the link at the top of the message!",
        iconURL:
          "http://91.99.239.6/files/suzie/kirbHead.png",
      });
  };

  // Build controls: Prev, Next and Page selector
  const prevBtn = new ButtonBuilder()
    .setCustomId("prev_page")
    .setEmoji("⬅️")
    .setStyle("Primary")
    .setDisabled(page === 0);

  const nextBtn = new ButtonBuilder()
    .setCustomId("next_page")
    .setEmoji("➡️")
    .setStyle("Primary")
    .setDisabled(page >= totalPages - 1);

  const pageOptions = Array.from({ length: totalPages }, (_, i) => ({
    label: `Page ${i + 1}`,
    value: String(i),
    default: i === page,
  }));
  const pageSelect = new StringSelectMenuBuilder()
    .setCustomId("jump_page")
    .setPlaceholder("Select page…")
    .addOptions(pageOptions);

  const controlsRow1 = new ActionRowBuilder().addComponents(pageSelect);
  const controlsRow2 = new ActionRowBuilder().addComponents(prevBtn, nextBtn);

  // Send initial
  const components = totalPages > 1 ? [controlsRow1, controlsRow2] : [];

  const message = await interaction.editReply({
    content: `# >> [Playlist Link](${playlistUrl}) <<`,
    embeds: [generateEmbed(page)],
    components: components,
    ephemeral: !makePublic,
  });

  const collector = message.createMessageComponentCollector({ time: 120000 });

  collector.on("collect", async (i) => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({ content: "Not for you!", ephemeral: true });
    }

    // Prev / Next
    if (i.customId === "prev_page" && page > 0) {
      page--;
    }
    if (i.customId === "next_page" && page < totalPages - 1) {
      page++;
    }

    // Jump via dropdown
    if (i.customId === "jump_page") {
      page = parseInt(i.values[0], 10);
    }

    // Update buttons’ disabled state and default option
    controlsRow2.components[0].setDisabled(page === 0);
    controlsRow2.components[1].setDisabled(page === totalPages - 1);
    controlsRow1.components[0].setOptions(
      pageOptions.map((opt, idx) => ({ ...opt, default: idx === page }))
    );

    await i.update({
      embeds: [generateEmbed(page)],
      components: [controlsRow1, controlsRow2],
    });
  });

  collector.on("end", () => {
    if (message.editable) {
      message.edit({ components: [] }).catch(() => {});
    }
  });
}

// Loads and parses CSV safely
function loadTracksFromCsv(filePath) {
  const csvData = fs.readFileSync(filePath, "utf8");
  const { data, errors, meta } = Papa.parse(csvData, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (header) => header.trim(),
  });

  // Manually check for duplicate headers
  const seen = new Set();
  for (const field of meta.fields) {
    if (seen.has(field)) {
      throw new Error(`Duplicate header detected: ${field}`);
    }
    seen.add(field);
  }

  if (errors.length > 0) {
    throw new Error(`CSV parsing error: ${errors[0].message}`);
  }

  return data.filter(
    (row) => row["Source"] && row["Song"] && row["URL"]
  );
}

let tracksCache = {
  mtimeMs: 0,
  tracks: [],
};

function getTracksForAutocomplete() {
  if (!fs.existsSync(tracksCsvPath)) return [];

  let stat;
  try {
    stat = fs.statSync(tracksCsvPath);
  } catch (err) {
    console.warn("Unable to stat submitter CSV:", err);
    return [];
  }

  if (stat.mtimeMs !== tracksCache.mtimeMs) {
    tracksCache = {
      mtimeMs: stat.mtimeMs,
      tracks: loadTracksFromCsv(tracksCsvPath),
    };
  }

  return tracksCache.tracks;
}

function getSubmitterNames() {
  const tracks = getTracksForAutocomplete();
  const unique = new Set();
  for (const track of tracks) {
    if (track["Nominator"]) unique.add(String(track["Nominator"]).trim());
  }
  return Array.from(unique)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function getSeriesNames() {
  const tracks = getTracksForAutocomplete();
  const unique = new Set();
  for (const track of tracks) {
    if (track["Source"]) unique.add(String(track["Source"]).trim());
  }
  return Array.from(unique)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}
