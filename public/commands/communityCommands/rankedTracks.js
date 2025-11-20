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

eval(fs.readFileSync("./public/imageprocessing/imagebuilder.js") + "");

const archiveFolder = path.join(
  __dirname,
  "..",
  "..",
  "utils",
  "archiveData"
);

module.exports = {
  data: (() => {
    return new SlashCommandBuilder()
      .setName("ranked-track")
      .setDescription(
        "Get a random or specific track from the rating archives!"
      )
      .addIntegerOption((option) =>
        option
          .setName("track-number")
          .setDescription("Use a VGM # to get a specific track")
      )
      .addStringOption((option) =>
      option
        .setName("submitter")
        .setDescription("Filter by the user name of the submitted tracks.")
    )
      .addStringOption((option) =>
        option
          .setName("series")
          .setDescription("Filter results by series/game. Returns a list.")
      )
      .addBooleanOption((option) =>
        option
          .setName("make-public")
          .setDescription("Choose to post the result publicly")
      );
  })(),

  async execute(interaction) {
    const inputNum = interaction.options.getInteger("track-number");
    const seriesSearch = interaction.options.getString("series");
    const submitter = interaction.options.getString("submitter");
    const makePublic = interaction.options.getBoolean("make-public") ?? false;


    // Validate mutually exclusive options
    if (inputNum !== null && submitter !== null) {
      return await interaction.reply({
        content:
          "The `submitter` option cannot be used in conjuction with `track-number`.",
        ephemeral: true,
      });
    }
    if (seriesSearch && inputNum !== null) {
      return await interaction.reply({
        content:
          "The `series` options cannot be used in conjuction with `track-number`.",
        ephemeral: true,
      });
    }

    await interaction.reply({
      content: "🎶 Fetching...",
      ephemeral: !makePublic,
    });

    await handleTrackFetch(
      interaction,
      inputNum,
      seriesSearch,
      submitter,
      makePublic,
      true
    );
  },
};

// Main track handling
async function handleTrackFetch(
  interaction,
  inputNum,
  seriesSearch,
  submitter,
  makePublic,
  useEditReply = false
) {
    let allTracks = [];
    const filePath = path.join(
        archiveFolder,
        `RtVGMPrevious.csv`
      );
    if (fs.existsSync(filePath)) {
        allTracks = loadTracksFromCsv(filePath);
    }
    console.log(`Loaded ${allTracks.length} ranked tracks from CSV.`);

  if (seriesSearch || submitter) {
    let matches = allTracks
    if (seriesSearch) { 
    // filter by series if requested
    const seriesFuse = new Fuse(allTracks, { keys: ["Source"], threshold: 0.2 });
    matches = seriesSearch
      ? seriesFuse.search(seriesSearch).map((r) => r.item)
      : matches;
    }

    // then filter by year if requested
    if (submitter) {
      const submitterFuse = new Fuse(matches, { keys: ["Nominator"], threshold: 0.2 });
      matches = submitter
        ? submitterFuse.search(submitter).map((r) => r.item)
        : matches;

      if (matches.length === 0) {
        return await interaction.editReply({
          content: `No tracks could be found with selected options.`,
          embeds: [],
          compontens: [],
          ephemeral: !makePublic,
        });
      }
    }

    if (matches.length === 0) {
      return await interaction.editReply({
        content: seriesSearch
          ? `No results found for series "${seriesSearch}" with selected options".`
          : "Could not find any tracks with selected options.",
        embeds: [],
        compontens: [],
        ephemeral: !makePublic,
      });
    }

    // paginate or list
    await paginateSeriesResults(
      interaction,
      matches,
      seriesSearch,
      makePublic,
      submitter
    );
    return;
  } 

  let chosenTrack = null;
  if (inputNum !== null) {
    const bvgmKey = Object.keys(allTracks[0]).find((k) =>
      k.toLowerCase().startsWith("id")
    );
    if (!bvgmKey) {
      return await interaction.editReply({
        content: `Track with ID number ${inputNum} does not exist.`,
        embeds: [],
        compontens: [],
        ephemeral: !makePublic,
      });
    }
    chosenTrack = allTracks.find((r) => parseInt(r[bvgmKey], 10) === inputNum);
    if (!chosenTrack) {
      return await interaction.editReply({
        content: `No track found with track number ${inputNum}.`,
        embeds: [],
        compontens: [],
        ephemeral: !makePublic,
      });
    }
  } else {
    const validTracks = allTracks.filter((r) => r["URL"]);
    chosenTrack = validTracks[Math.floor(Math.random() * validTracks.length)];
  }

  if (!chosenTrack) {
    return await interaction.editReply({
      content: "Could not find a track to show with selected options.",
      embeds: [],
      compontens: [],
      ephemeral: !makePublic,
    });
  }

  return await sendEmbed(
    interaction,
    chosenTrack,
    makePublic,
    useEditReply
  );
}

// Builds the embed
function buildEmbedForTrack(track) {
  const title = `${track["Source"] || "Unknown Game"} – ${track["Song"] || "Unknown Track"}`;

  const embed = new EmbedBuilder()
    .setColor(parseInt("FD3DB5", 16))
    .setTitle(title)
    .setURL(track["URL"] || null)
    .setAuthor({
      name: "Submission #" + track["ID"] || "???",
      iconURL: "https://cdn.discordapp.com/attachments/1432140713306488974/1439057572039495720/Bot_icon2.png?ex=691f110d&is=691dbf8d&hm=42bb22bb0963dc5067e38532eb7fe7078c7f92b776867720277888a89963053d&",
    });

  if (track["URL"]) {
    embed.setThumbnail(
      `https://img.youtube.com/vi/${extractVideoId(track["URL"])}/0.jpg`
    );
  }

  if (track["Nominator"]) {
    embed.addFields({
      name: "Nominator",
      value: track["Nominator"],
      inline: false,
    });
  }

  if (track["Platform"]) {
    embed.addFields({
      name: "Platform",
      value: track["Platform"] || "Unknown",
      inline: true,
    });
  }
  if (track["Franchise"]) {
    embed.addFields({
      name: "Franchise",
      value: track["Franchise"] || "Unknown",
      inline: true,
    });
  }

  if (track["Year of release"]) {
    embed.addFields({
      name: "Year of Release",
      value: track["Year of release"] || "Unknown",
      inline: true,
    });
  }
  const footerText = "Rate the VGM Project";
  embed.setFooter({
    text: footerText,
    iconURL:
      "https://media.tenor.com/idS-Mx-F43QAAAAi/kirby-dancing.gif",
  });

  return embed;
}

// YouTube ID extractor
function extractVideoId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  return match ? match[1] : null;
}

// Load contributor metadata
function getContributorMap() {
  const contributors = {};
  try {
    const fileData = fs.readFileSync(contributorCsvPath, "utf8");
    const lines = fileData.split(/\r?\n/);
    if (lines.length < 2) return contributors;

    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
    const seriesNameIdx = headers.findIndex(
      (h) => h.toLowerCase() === "series name"
    );
    const userColorIdx = headers.findIndex(
      (h) => h.toLowerCase() === "user color"
    );
    const userNameIdx = headers.findIndex(
      (h) => h.toLowerCase() === "user name"
    );
    const worksheetIdIdx = headers.findIndex(
      (h) => h.toLowerCase() === "worksheet id"
    );
    const iconUrlIdx = headers.findIndex((h) => h.toLowerCase() === "icon url");

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(",");
      if (row.length <= Math.max(seriesNameIdx, worksheetIdIdx)) continue;

      const seriesName = row[seriesNameIdx]?.trim().replace(/"/g, "");
      const userColor = row[userColorIdx]?.trim().replace(/"/g, "");
      const userName = row[userNameIdx]?.trim().replace(/"/g, "");
      const worksheetId = row[worksheetIdIdx]?.trim().replace(/"/g, "");
      const iconUrl =
        row[iconUrlIdx]?.trim().replace(/"/g, "") || DEFAULT_ICON_URL;

      if (worksheetId && userName) {
        contributors[userName] = {
          userName,
          worksheetId,
          seriesName,
          userColor,
          iconUrl,
        };
      }
    }
  } catch (err) {
    console.error("Error reading contributorVgm.csv:", err);
  }
  return contributors;
}

async function sendEmbed(
  interaction,
  track,
  makePublic,
  useEditReply
) {
  const embed = buildEmbedForTrack(track);
  const payload = {
    content: "", // Clear the original message content
    embeds: [embed],
    components: [], // Remove dropdown or buttons
    ephemeral: !makePublic,
  };

  if (useEditReply) {
    return await interaction.editReply(payload);
  } else {
    return await interaction.followUp(payload);
  }
}

async function paginateSeriesResults(
  interaction,
  matches,
  seriesSearch,
  makePublic,
  submitter
) {
  // Sort entries
  matches.sort((a, b) => {
    const aGame = (a["Source"] || "").toLowerCase();
    const bGame = (b["Source"] || "").toLowerCase();
    const cmp = aGame.localeCompare(bGame);
    if (cmp !== 0) return cmp;
    return (a["Song"] || "").localeCompare(b["Song"] || "");
  });

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
      const who = t["Nominator"] || "???";;
      return `${idx}. ${url ? `[${title}](${url})` : title} – ${game} | ${who}`;
    });

    const headerParts = [];
    if (submitter)
      headerParts.push(submitter);
    if (seriesSearch) headerParts.push(seriesSearch);
    const title = `🎵 Results for ${headerParts.join(" – ")}`;

    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(
        "────────────────────────────\n" +
          lines.join("\n") +
          "\n────────────────────────────"
      )
      .setColor(0x5865f2)
      .setFooter({
        text:
          `Page ${page + 1}/${totalPages} - ${matches.length} entries`,
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
    content: "",
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
  console.log(`Loading ranked tracks from CSV at: ${filePath}`);
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
