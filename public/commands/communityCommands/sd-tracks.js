const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const https = require("https");
const { promisify } = require("util");
const readdirAsync = promisify(fs.readdir);
const unlinkAsync = promisify(fs.unlink);
const statAsync = promisify(fs.stat);
const stream = require("stream");
const pipeline = promisify(stream.pipeline);

eval(fs.readFileSync("./public/tournament/tournamentutils.js") + "");
eval(fs.readFileSync("./public/imageprocessing/imagebuilder.js") + "");

let mainVgmData = [];
let locationVgmData = [];

// Load the main CSV and filter out empty rows
fs.createReadStream("./public/utils/sdArchiveData/mainSheetData.csv")
  .pipe(csv())
  .on("data", (row) => {
    if (row["Game Title"]) {
      const lowerCaseRow = {};
      for (const key in row) {
        lowerCaseRow[key.toLowerCase()] = row[key];
      }
      mainVgmData.push(lowerCaseRow);
    }
  })
  .on("end", () => {
    console.log(`Loaded ${mainVgmData.length} main VGM tracks.`);
  });

// Load the location CSV
fs.createReadStream("./public/utils/sdArchiveData/locationSheetData.csv")
  .pipe(csv())
  .on("data", (row) => {
    const lowerCaseRow = {};
    for (const key in row) {
      lowerCaseRow[key.toLowerCase()] = row[key];
    }
    locationVgmData.push(lowerCaseRow);
  })
  .on("end", () => {
    console.log(`Loaded ${locationVgmData.length} location VGM tracks.`);
  });

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sd-track")
    .setDescription(
      "Get a random or specific track from the SupraDarky catalogue!"
    )
    .addIntegerOption((option) =>
      option
        .setName("track-number")
        .setDescription("Optional VGM # to get a specific track")
    )
    .addStringOption((option) =>
      option
        .setName("series")
        .setDescription("Search by series/game name. Returns a list")
    )
    .addIntegerOption((option) =>
      option
        .setName("year")
        .setDescription("Filter results by year of release.  Returns a list.")
    )
    .addBooleanOption((option) =>
      option
        .setName("make-public")
        .setDescription("Choose to post the result publicly")
    ),
  async execute(interaction) {
    const seriesSearch = interaction.options.getString("series");
    const inputNum = interaction.options.getInteger("track-number");
    const yearFilter = interaction.options.getInteger("year");
    const makePublic = interaction.options.getBoolean("make-public") ?? false;

    // Validate mutually exclusive options
    if (inputNum !== null && yearFilter !== null) {
      return await interaction.reply({
        content:
          "The `year` option cannot be used in conjuction with `track-number`.",
        ephemeral: true,
      });
    }

    if (inputNum !== null && seriesSearch !== null) {
      return await interaction.reply({
        content:
          "The `series` option cannot be used in conjuction with `track-number`.",
        ephemeral: true,
      });
    }

    var matches = mainVgmData;

    if (seriesSearch || yearFilter !== null) {
      if (seriesSearch !== null) {
        matches = mainVgmData.filter((track) =>
          track["game title"]
            ?.toLowerCase()
            .includes(seriesSearch.toLowerCase())
        );
      }

      if (yearFilter !== null) {
        matches = matches.filter(
          (t) => String(t["year of release"]) === String(yearFilter)
        );
      }

      if (matches.length === 0) {
        return await interaction.reply({
          content: `No results for "${seriesSearch}".`,
          ephemeral: !makePublic,
        });
      }

      console.log(matches[0]);

      return await paginateSeriesResults(
        interaction,
        matches,
        seriesSearch,
        makePublic,
        yearFilter
      );
    }

    let track;
    if (inputNum !== null) {
      track = mainVgmData.find((row) => parseInt(row["bvgm#"]) === inputNum);
      if (!track) {
        return await interaction.reply({
          content: `No track found with track number ${inputNum}.`,
          ephemeral: !makePublic,
        });
      }
    } else {
      // Pick randomly from entries that have a YouTube URL
      const candidates = mainVgmData.filter((row) => row["youtube url"]);
      track = candidates[Math.floor(Math.random() * candidates.length)];
    }

    if (!track)
      return await interaction.reply({
        content: "Could not find a track with selected options.",
        ephemeral: !makePublic,
      });
    console.log(track);
    console.log(track["bvgm#"]);
    const bgmNum = parseInt(track["bvgm#"], 10) - 1;
    const locationInfo = locationVgmData[bgmNum];
    console.log(locationInfo);

    const title = `${track["game title"] || "Unknown Game"} – ${
      track["piece title"] || "Unknown Track"
    }`;
    const youtubeUrl = track["youtube url"] || null;

    let formattedUrl = await GetYtThumb([youtubeUrl], true);

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setURL(youtubeUrl)
      .setAuthor({
        name: track["sd label"] || "Unknown Label",
        iconURL:
          "https://cdn.glitch.global/485febab-53bf-46f2-9ec1-a3c597dfaebe/SD%20Logo.png?v=1676855711752",
      })
      .setColor(0x5865f2)
      .setThumbnail(formattedUrl[0][0])
      .setFooter({
        text: "Supradarky's VGM Club",
        iconURL:
          "https://cdn.glitch.global/485febab-53bf-46f2-9ec1-a3c597dfaebe/sd-img.jpeg?v=1676586931016",
      });

    // Add inline fields if they exist
    if (track["composer(s)"] && track["composer(s)"].trim() !== "") {
      embed.addFields({
        name: "Composers",
        value: track["composer(s)"],
        inline: false,
      });
    }

    const platform = track["platform"];
    const year = track["year of release"];
    const platformYearFields = [];

    if (platform && platform.trim() !== "") {
      platformYearFields.push({
        name: "Platform",
        value: platform,
        inline: true,
      });
    }
    if (year && year.trim() !== "") {
      platformYearFields.push({
        name: "Year of Release",
        value: year,
        inline: true,
      });
    }
    if (platformYearFields.length === 1) {
      platformYearFields.push({
        name: "\u200B",
        value: "\u200B",
        inline: true,
      });
    }

    embed.addFields(platformYearFields);

    const type = locationInfo ? locationInfo["track type"] : null;
    const location = locationInfo ? locationInfo["location"] : null;
    const trackLocFields = [];

    if (type && type.trim() !== "") {
      trackLocFields.push({
        name: "Track Type",
        value: type,
        inline: true,
      });
    }
    if (location && location.trim() !== "") {
      trackLocFields.push({
        name: "In-Game Location",
        value: location,
        inline: true,
      });
    }
    if (trackLocFields.length === 1) {
      trackLocFields.push({ name: "\u200B", value: "\u200B", inline: true });
    }

    embed.addFields(trackLocFields);

    if (locationInfo && locationInfo["track type"]) {
      const trackType = locationInfo["track type"].toUpperCase();
      let embedColor;

      if (trackType === "MENU") embedColor = 0xffd700;
      // Gold
      else if (trackType === "LEVEL") embedColor = 0x0000ff;
      // Blue
      else if (trackType === "BOSS") embedColor = 0xff0000;
      // Red
      else if (trackType === "THEME") embedColor = 0x800080;
      // Purple
      else if (trackType === "PLAY") embedColor = 0xffa500;
      // Orange
      else if (trackType === "SCENE") embedColor = 0x008000;
      // Green
      else embedColor = 0xffffff; // White

      embed.setColor(embedColor);
    } else {
      embed.setColor(0xffffff); // White if no track type
    }

    if (youtubeUrl) {
      embed.addFields({
        name: "URL",
        value: youtubeUrl,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: !makePublic });
    if (youtubeUrl) {
      /*embed.addFields({
        name: "URL",
        value: youtubeUrl,
        inline: false,
      });*/
      /*await interaction.followUp({
        content: "Video: " + youtubeUrl,
        ephemeral: !makePublic,
      });*/
    }
  },
};

async function handleSeriesResults(
  interaction,
  matches,
  makePublic,
  yearFilter = null,
  locationVgmData
) {
  let index = 0;

  const buildEmbed = async (track) => {
    const bgmNum = parseInt(track["bvgm#"], 10) - 1;
    const locationInfo = locationVgmData[bgmNum];

    const embed = new EmbedBuilder()
      .setTitle(`${track["game title"]} – ${track["piece title"]}`)
      .setURL(track["youtube url"])
      .setColor(0x5865f2)
      .setAuthor({
        name: track["sd label"] || "Unknown Label",
        iconURL:
          "https://cdn.glitch.global/485febab-53bf-46f2-9ec1-a3c597dfaebe/SD%20Logo.png?v=1676855711752",
      })
      .setFooter({
        text: `Result ${index + 1} of ${matches.length}`,
        iconURL:
          "https://cdn.glitch.global/485febab-53bf-46f2-9ec1-a3c597dfaebe/sd-img.jpeg?v=1676586931016",
      });

    if (locationInfo && locationInfo["track type"]) {
      const trackType = locationInfo["track type"].toUpperCase();
      let embedColor;

      if (trackType === "MENU") embedColor = 0xffd700;
      // Gold
      else if (trackType === "LEVEL") embedColor = 0x0000ff;
      // Blue
      else if (trackType === "BOSS") embedColor = 0xff0000;
      // Red
      else if (trackType === "THEME") embedColor = 0x800080;
      // Purple
      else if (trackType === "PLAY") embedColor = 0xffa500;
      // Orange
      else if (trackType === "SCENE") embedColor = 0x008000;
      // Green
      else embedColor = 0xffffff; // White

      embed.setColor(embedColor);
    } else {
      embed.setColor(0xffffff); // White if no track type
    }

    // Add thumbnail
    const thumbs = await GetYtThumb([track["youtube url"]], true);
    if (thumbs && thumbs[0] && thumbs[0][0]) {
      embed.setThumbnail(thumbs[0][0]);
    }

    // Add metadata like before...
    if (track["composer(s)"]) {
      embed.addFields({
        name: "Composers",
        value: track["composer(s)"],
        inline: false,
      });
    }
    // Platform + Year
    const fields = [];
    if (track["platform"])
      fields.push({ name: "Platform", value: track["platform"], inline: true });
    if (track["year of release"])
      fields.push({
        name: "Year of Release",
        value: track["year of release"],
        inline: true,
      });
    embed.addFields(fields);

    // Track type + location
    const secondLine = [];
    if (locationInfo && locationInfo["track type"])
      secondLine.push({
        name: "Track Type",
        value: locationInfo["track type"],
        inline: true,
      });
    if (locationInfo && locationInfo["location"])
      secondLine.push({
        name: "In-Game Location",
        value: locationInfo["location"],
        inline: true,
      });

    embed.addFields(secondLine);

    if (track["Youtube URL"]) {
      embed.addFields({
        name: "URL",
        value: track["Youtube URL"],
        inline: false,
      });
    }

    return embed;
  };

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("prev")
      .setLabel("⬅️")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("next")
      .setLabel("➡️")
      .setStyle(ButtonStyle.Primary)
  );

  const message = await interaction.reply({
    embeds: [await buildEmbed(matches[index])],
    components: [row],
    fetchReply: true,
    ephemeral: !makePublic,
  });

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: 600000,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "next") index = (index + 1) % matches.length;
    if (i.customId === "prev")
      index = (index - 1 + matches.length) % matches.length;

    await i.update({
      embeds: [await buildEmbed(matches[index])],
      components: [row],
    });
  });

  collector.on("end", () => {
    message.edit({ components: [] }).catch(() => {});
  });
}

async function paginateSeriesResults(
  interaction,
  matches,
  seriesSearch,
  makePublic,
  yearFilter = null,
  selectedContributor = null
) {
  await interaction.reply({
    content: "🎶 Fetching...",
    ephemeral: !makePublic,
  });
  // Sort entries
  matches.sort((a, b) => {
    const aGame = (a["Game Title"] || "").toLowerCase();
    const bGame = (b["Game Title"] || "").toLowerCase();
    const cmp = aGame.localeCompare(bGame);
    if (cmp !== 0) return cmp;
    return (a["piece title"] || "").localeCompare(b["piece title"] || "");
  });

  let page = 0;
  const itemsPerPage = 10;
  const totalPages = Math.ceil(matches.length / itemsPerPage);

  const generateEmbed = (page) => {
    const start = page * itemsPerPage;
    const slice = matches.slice(start, start + itemsPerPage);
    const lines = slice.map((t, i) => {
      const idx = start + i + 1;
      const url = t["youtube url"];
      const title = t["piece title"] || "Unknown";
      const game = t["game title"] || "Unknown Game";
      const label = t["sd label"] || "";
      return `${idx}. ${
        url ? `[${title}](${url})` : title
      } – ${game} | ${label}`;
    });

    const headerParts = [];
    if (seriesSearch) headerParts.push(seriesSearch);
    if (yearFilter) headerParts.push(String(yearFilter));
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
        text: `Page ${page + 1}/${totalPages} — ${matches.length} entries`,
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
