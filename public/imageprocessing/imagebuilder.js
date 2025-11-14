const path = require("path");
const fs = require("fs");
const { readdir, unlink, writeFileSync, copyFile } = require("fs");
const { promisify } = require("util");

const http = require("http");
const https = require("https");
const Stream = require("stream").Transform;

eval(fs.readFileSync("./public/tournament/tournamentutils.js") + "");

var request = require("request");

const readdirAsync = promisify(readdir);
const unlinkAsync = promisify(unlink);
const copyFileAsync = promisify(copyFile);

async function GetYtThumb(urls, standardRes = false) {
  var formattedUrls = [];
  urls.forEach((url) => {
    var ytVideoId = extractYoutubeVideoID(url);

    const urlEnd = standardRes ? "/sddefault.jpg" : "/mqdefault.jpg";

    //let thumb = "https://i1.ytimg.com/vi/" + ytVideoId + "/maxresdefault.jpg";
    let thumb =
      ytVideoId == "zero"
        ? "https://cdn.glitch.global/bc159225-9a66-409e-9e5f-5467f5cfd19b/Album%20Art.png?v=1724065338538"
        : "https://i1.ytimg.com/vi/" + ytVideoId + urlEnd;

    formattedUrls.push([thumb, ytVideoId]);
  });
  //Example of usage:
  console.log(formattedUrls);
  return formattedUrls;
}

async function downloadImages(urls, singleImage = false) {
  return new Promise(async (resolve) => {
    if (urls.length < 1) {
      resolve();
    } else {
      const youtubeImages = await GetYtThumb(urls);

      let inputPath = "public/commands/gif/input/";
      let endImgPath = "public/commands/gif/jpg/";
      console.log(inputPath);

      if (!singleImage) {
        const files = await readdirAsync(inputPath);
        await Promise.all(
          files.map((file) => unlinkAsync(path.join(inputPath, file)))
        );
      }

      await Promise.all(
        youtubeImages.map(async (image) => {
          const fileExists = fileExistsWithoutExtension(inputPath, image[1]);

          if (fileExists) {
            if (!singleImage) {
              await copyFileWithoutExtension(endImgPath, image[1], inputPath);
            }
          } else {
            const downloadPath = singleImage ? endImgPath : inputPath;
            await downloadImage(
              image[0],
              path.join(downloadPath, image[1] + ".jpg")
            );
          }
        })
      );

      resolve();
    }
  });
}

async function downloadImage(uri, filename) {
  return new Promise((resolve, reject) => {
    const client = uri.startsWith("https") ? https : http;
    client
      .request(uri, (response) => {
        const data = new Stream();

        response.on("data", (chunk) => {
          data.push(chunk);
        });

        response.on("end", () => {
          try {
            writeFileSync(filename, data.read());
            console.log(`File downloaded: ${filename}`);
            resolve();
          } catch (error) {
            reject(`Error writing file: ${error.message}`);
          }
        });
      })
      .end();
  });
}

function fileExistsWithoutExtension(folderPath, fileName) {
  const files = fs.readdirSync(folderPath);

  return files.some((file) => {
    const fileNameWithoutExt = path.parse(file).name;
    return fileNameWithoutExt === fileName;
  });
}

async function copyFileWithoutExtension(
  folderPath,
  fileName,
  targetFolderPath
) {
  const files = await readdirAsync(folderPath);

  await Promise.all(
    files.map(async (file) => {
      const fileNameWithoutExt = path.parse(file).name;

      if (fileNameWithoutExt === fileName) {
        const sourceFilePath = path.join(folderPath, file);
        const targetFilePath = path.join(targetFolderPath, file);

        try {
          await copyFileAsync(sourceFilePath, targetFilePath);
          console.log(`Copied file: ${file}`);
        } catch (err) {
          console.error(`Error copying file: ${file}`, err);
        }
      }
    })
  );
}
