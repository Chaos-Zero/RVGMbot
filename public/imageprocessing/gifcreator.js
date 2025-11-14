const GIFEncoder = require("gif-encoder-2");
const { createCanvas, Image } = require("canvas");
const path = require("path");
const {
  writeFileSync,
  readFileSync,
  existsSync,
  createReadStream,
  createWriteStream,
  readdir,
  unlink,
  rename,
} = require("fs");
const { promisify } = require("util");

eval(readFileSync("./public/imageprocessing/imagebuilder.js") + "");

var Stream = require("stream").Transform;

const readdirAsync = promisify(readdir);
let imagesFolder = "public/commands/gif/input/";
let imagesOutputFolder = "public/commands/gif/jpg/";

let dstPath = "public/commands/gif/output";

async function createGif(algorithm, gifName) {
  return new Promise(async (resolve) => {
    try {
      const dstPath = path.join(
        "public/commands/gif/output/",
        gifName + ".gif"
      );
      const files = await readdirAsync(imagesFolder);
      console.log("Files found:", files);

      if (existsSync(dstPath)) {
        console.log("gif already exists");
        resolve();
      } else {
        if (files.length === 0) {
          throw new Error("No files found in the images folder.");
        }

        const firstFile = path.join(imagesFolder, files[0]);
        console.log("First file path:", firstFile);

        if (!existsSync(firstFile)) {
          throw new Error(`The file ${firstFile} does not exist.`);
        }

        // find the width and height of the image
        const [width, height] = await new Promise((resolve2) => {
          const image = new Image();
          image.onload = () => resolve2([image.width, image.height]);
          image.onerror = (err) => {
            console.error("Error loading image:", err);
            resolve2([undefined, undefined]);
          };
          image.src = firstFile;
        });

        if (!width || !height) {
          throw new Error("Image dimensions could not be determined.");
        }

        const writeStream = createWriteStream(dstPath);
        // when stream closes GIF is created so resolve promise
        writeStream.on("close", () => {
          resolve();
        });

        const encoder = new GIFEncoder(width, height, algorithm, true);
        // pipe encoder's read stream to our write stream
        encoder.createReadStream().pipe(writeStream);
        encoder.start();
        encoder.setDelay(2000);
        encoder.setRepeat(20);

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");
        console.log("We have created the canvas");

        // draw an image for each file and add frame to encoder
        for (const file of files) {
          await new Promise((resolve3) => {
            const image = new Image();
            image.onload = () => {
              ctx.drawImage(image, 0, 0);
              encoder.addFrame(ctx);
              resolve3();
            };
            image.onerror = (err) => {
              console.error(`Error loading image ${file}:`, err);
              resolve3();
            };
            image.src = path.join(imagesFolder, file);

            // Log the image path being processed
            console.log(`Processing file: ${image.src}`);
          });
        }

        encoder.finish();
        console.log("gif created");
        resolve();
      }
    } catch (error) {
      console.error("An error occurred during GIF creation:", error);
      resolve();
    }
  });
}
//createGif('neuquant')

//var encoder = new GIFEncoder();
//encoder.setRepeat(0);
//encoder.setDelay(100);
//encoder.start();
//encoder.addFrame(document.getElementById('img1'));
//encoder.addFrame(document.getElementById('img2'));
//encoder.addFrame(document.getElementById('img3'));
//encoder.finish();
//var binary_gif = encoder.stream().getData();
//var data_url = 'data:image/gif;base64,'+encode64(binary_gif);
