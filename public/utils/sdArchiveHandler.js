const fetch = require("node-fetch");
const fs = require("fs").promises;
const path = require("path");

const outputDir = path.join(__dirname, "public", "utils", "sdArchiveData");

const sheets = [
  {
    sheetId: "1Hl11drnPsymQADL1c7bP7p53AU0udT63uEsvyyS2F70",
    tabs: [{ gid: "0", filename: "mainSheetData.csv", removePreamble: true }],
  },
  {
    sheetId: "1KCxJ0BCaHtupXAv8TUUP-1RzbjJd0ZPI2_K9PrP90p0",
    tabs: [
      { gid: "0", filename: "locationSheetData.csv", removePreamble: false },
    ],
  },
];

const contributorVgmSheet = {
  sheetId: "1KhA-lEXLwCsGiScPucGZffgBF6fh3PDpSbIWHVw4Cs8",
  gid: "0",
};

const MAX_CONCURRENT_DOWNLOADS = 10;

async function PopulateSdVgmLinks() {
  // 1. Download static sheets
  for (const sheet of sheets) {
    for (const tab of sheet.tabs) {
      const url = `https://docs.google.com/spreadsheets/d/${sheet.sheetId}/export?format=csv&id=${sheet.sheetId}&gid=${tab.gid}`;
      const filePath = path.join(outputDir, tab.filename);
      const file = await fetchAndSaveCSV(url, filePath, tab.removePreamble);

      if (!file) {
        console.error(`Failed to fetch and save ${tab.filename}`);
      }
    }
  }

  // 2. Download contributorVgmSheet GID 0
  const contributorVgmUrl = `https://docs.google.com/spreadsheets/d/${contributorVgmSheet.sheetId}/export?format=csv&id=${contributorVgmSheet.sheetId}&gid=${contributorVgmSheet.gid}`;
  const contributorVgmPath = path.join(outputDir, "contributorVgm.csv");

  const contributorVgmFile = await fetchAndSaveCSV(
    contributorVgmUrl,
    contributorVgmPath,
    false
  );

  if (!contributorVgmFile) {
    console.error("Failed to fetch contributorVgm main page.");
    return;
  }

  // 3. Parse contributorVgm.csv, download series, and create JSON map
  await downloadAllSeriesCsvsThrottled(contributorVgmPath);

  console.log("All CSV files downloaded and saved.");
}

async function fetchAndSaveCSV(url, filePath, removePreamble) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    let csvData = await response.text();

    if (removePreamble) {
      const lines = csvData.split("\n");
      csvData = lines.slice(4).join("\n"); // Remove first 4 lines
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, csvData, "utf8");
    console.log(`CSV data written to ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`Error fetching and saving ${filePath}:`, error);
    return null;
  }
}

async function downloadAllSeriesCsvsThrottled(contributorVgmPath) {
  try {
    const data = await fs.readFile(contributorVgmPath, "utf8");
    const lines = data.split(/\r?\n/);

    if (lines.length < 2) {
      console.error("contributorVgm.csv appears empty or too short.");
      return;
    }

    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
    const seriesNameIndex = headers.findIndex(
      (h) => h.toLowerCase() === "series name"
    );
    const worksheetIdIndex = headers.findIndex(
      (h) => h.toLowerCase() === "worksheet id"
    );

    if (seriesNameIndex === -1 || worksheetIdIndex === -1) {
      console.error("Could not find Series Name or Worksheet ID columns.");
      return;
    }

    const downloadTasks = [];
    const seriesMap = {};
    const idRewriteMap = {};

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(",");
      if (row.length <= Math.max(seriesNameIndex, worksheetIdIndex)) continue;

      const seriesName = row[seriesNameIndex].trim().replace(/"/g, "");
      const worksheetRaw = row[worksheetIdIndex].trim().replace(/"/g, "");
      if (!seriesName || !worksheetRaw) continue;

      let downloadUrl;
      let safeWorksheetId;

      if (/^https?:\/\//.test(worksheetRaw)) {
        // we got a full URL: parse its sheetId and download gid=0
        const match = worksheetRaw.match(/\/d\/([^\/]+)/);
        const externalSheetId = match && match[1];
        if (!externalSheetId) {
          console.warn(`Unable to parse sheet ID from URL: ${worksheetRaw}`);
          continue;
        }
        downloadUrl = `https://docs.google.com/spreadsheets/d/${externalSheetId}/export?format=csv&id=${externalSheetId}&gid=0`;
        safeWorksheetId = externalSheetId;
      } else {
        // numeric gid from the contributorVgm sheet
        downloadUrl = `https://docs.google.com/spreadsheets/d/${contributorVgmSheet.sheetId}/export?format=csv&id=${contributorVgmSheet.sheetId}&gid=${worksheetRaw}`;
        safeWorksheetId = worksheetRaw.replace(/[^\w\-]/g, "");
      }

      // record for JSON map
      seriesMap[safeWorksheetId] = seriesName;
      idRewriteMap[worksheetRaw] = safeWorksheetId;

      const filePath = path.join(outputDir, `${safeWorksheetId}.csv`);
      downloadTasks.push(() => fetchAndSaveCSV(downloadUrl, filePath, false));
    }

    // run the downloads in parallel, but throttled
    await throttlePromises(downloadTasks, MAX_CONCURRENT_DOWNLOADS);

    // write out the map
    const mapPath = path.join(outputDir, "seriesMap.json");
    await fs.writeFile(mapPath, JSON.stringify(seriesMap, null, 2), "utf8");
    console.log(`Series map written to ${mapPath}`);
    
    const newLines = [lines[0]];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const raw = cols[worksheetIdIndex];
      if (idRewriteMap[raw]) {
        cols[worksheetIdIndex] = idRewriteMap[raw];
      }
      newLines.push(cols.join(","));
    }
    await fs.writeFile(contributorVgmPath, newLines.join("\n"), "utf8");
    console.log(`Updated contributorVgm.csv with safe worksheet IDs.`);
  } catch (error) {
    console.error("Error parsing contributorVgm.csv:", error);
  }
}

async function throttlePromises(taskFunctions, maxConcurrent) {
  const results = [];
  let active = 0;
  let current = 0;

  return new Promise((resolve, reject) => {
    function next() {
      if (current >= taskFunctions.length) {
        if (active === 0) {
          resolve(results);
        }
        return;
      }

      while (active < maxConcurrent && current < taskFunctions.length) {
        const taskFn = taskFunctions[current++];
        active++;

        taskFn()
          .then((result) => {
            results.push(result);
            active--;
            next();
          })
          .catch((error) => {
            console.error("Task failed:", error);
            results.push(null);
            active--;
            next();
          });
      }
    }

    next();
  });
}

module.exports = { PopulateSdVgmLinks };
