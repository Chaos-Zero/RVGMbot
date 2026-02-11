const { google } = require("googleapis");
const fs = require("fs");
const readline = require("readline");
const OAuth2 = google.auth.OAuth2;
const sleep = require("util").promisify(setTimeout);

eval(fs.readFileSync("./public/database/write.js") + "");
eval(fs.readFileSync("./public/collections/tournamentCells.js") + "");

const oauth2ClientSheets = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_SECRET,
  process.env.REDIRECT_URI
);

const sheetsTokenPath = process.env.SHEETS_TOKEN_PATH;

async function SetSheetCredentials() {
  return new Promise((resolve, reject) => {
    fs.readFile(sheetsTokenPath, (err, token) => {
      if (err) {
        console.error("Error reading the token file:", err);
        reject(err);
      } else {
        oauth2ClientSheets.setCredentials(JSON.parse(token));
        resolve();
      }
    });
  });
}

const sheets = google.sheets({ version: "v4", auth: oauth2ClientSheets });
/**
 * Fills a specified cell and the next two cells beneath it in a Google Sheet.
 *
 * @param {string} spreadsheetId The ID of the spreadsheet.
 * @param {string} range The A1 notation of the range to write to (e.g., 'Sheet1!A1').
 * @param {Array} values The values to write (should be an array of arrays, each inner array contains one row of data).
 */
/**
 * Fills consecutive cells in a Google Sheet starting from a specified cell with an offset.
 *
 * @param {string} spreadsheetId The ID of the spreadsheet.
 * @param {string} sheetName The name of the sheet (e.g., 'Bracket').
 * @param {number} matchNumber The match number to determine the starting cell.
 * @param {Array} values An array of up to three strings to write into the cells.
 * @param {Object} cellsMapping An object mapping match numbers to cell positions (e.g., { 1: 'A4', ... }).
 * @param {number} [startIndex=0] The starting index offset from the mapped cell.
 */
async function fillCells(
  spreadsheetUrl,
  sheetName,
  matchNumber,
  values,
  startIndex = 0
) {
  try {
    await SetSheetCredentials(); // Ensure credentials are set
    await sleep(1000);
    var spreadsheetId = extractSpreadsheetIdFromUrl(spreadsheetUrl);

    const startCell = bestVGM2023Cells[`match${matchNumber}`];
    if (!startCell) {
      throw new Error("Invalid match number or cell mapping.");
    }

    const baseColumn = startCell.substring(0, 1); // Assuming single-letter column names
    const startRow = parseInt(startCell.substring(1), 10) + startIndex;
    const data = values.map((value, index) => ({
      range: `${sheetName}!${baseColumn}${startRow + index}`,
      values: [[value]],
    }));

    const batchUpdateRequest = {
      valueInputOption: "USER_ENTERED",
      data: data,
    };

    const result = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: spreadsheetId,
      resource: batchUpdateRequest,
    });

    console.log(`${result.data.totalUpdatedCells} cells updated.`);
  } catch (err) {
    console.error("The API returned an error:", err);
  }
}

async function colourCells(spreadsheetUrl, cellColorMappings) {
  try {
    await SetSheetCredentials();
    await sleep(1000); // Ensure credentials are set
    var spreadsheetId = extractSpreadsheetIdFromUrl(spreadsheetUrl);

    const requests = cellColorMappings.map(mapping => {
      const cell = Object.keys(mapping)[0]; // e.g., 'A3'

      if (!cell) {
        throw new Error('Invalid cell reference found.');
      }

      const color = mapping[cell];
      const columnMatch = cell.match(/[A-Za-z]+/);
      const rowMatch = cell.match(/\d+/);

      if (!columnMatch || !rowMatch) {
        throw new Error(`Invalid cell format: ${cell}`);
      }

      const column = columnMatch[0];
      const row = parseInt(rowMatch[0], 10);

      const columnIndex =
        column.split("").reduce((sum, letter) => {
          return sum * 26 + (letter.charCodeAt(0) - 64);
        }, 0) - 1; // Convert column letter(s) to zero-based index

      return {
        updateCells: {
          range: {
            sheetId: 0,
            startRowIndex: row - 1,
            endRowIndex: row,
            startColumnIndex: columnIndex,
            endColumnIndex: columnIndex + 1,
          },
          rows: [
            {
              values: [
                {
                  userEnteredFormat: {
                    backgroundColor: color,
                  },
                },
              ],
            },
          ],
          fields: "userEnteredFormat.backgroundColor",
        },
      };
    });

    if (requests.length == 0) {
      throw new Error('No valid requests found.');
    }

    const batchUpdateRequest = { requests };

    const result = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      resource: batchUpdateRequest,
    });

    console.log("Cells colored successfully.");
  } catch (err) {
    console.error("The API returned an error:", err);
  }
}

function extractSpreadsheetIdFromUrl(url) {
  // Regular expression to match the standard Google Sheets URL format
  const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  const matches = url.match(regex);

  if (matches && matches[1]) {
    return matches[1];
  } else {
    return null; // Invalid URL or no ID found
  }
}

//fillCells(spreadsheetId, range, values);
