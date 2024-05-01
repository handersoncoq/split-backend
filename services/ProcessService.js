import ytdl from "ytdl-core";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import config from "../config.js";

const getFullUrl = (req) => `${req.protocol}://${req.get("host")}`;

export const downloadYouTubeAudio = async (url) => {
  return new Promise((resolve, reject) => {
      const audioPath = path.resolve(config.basePath, "downloads", "audio.mp3");
      const outputPath = path.resolve(audioPath, "downloads", "audio.mp3");
      const directory = path.dirname(outputPath);

      
      if (!fs.existsSync(directory)) {
          fs.mkdirSync(directory, { recursive: true });
      }

      const stream = ytdl(url, { quality: 'highestaudio', filter: 'audioonly' });
      const outputStream = fs.createWriteStream(outputPath);

      stream.pipe(outputStream);
      stream.on('error', error => {
          console.error("Error in downloading stream:", error);
          reject(error);
      });
      outputStream.on('finish', () => {
          console.log("Download and save complete:", outputPath);
          resolve(outputPath);
      });
      outputStream.on('error', error => {
          console.error("Error in saving file:", error);
          reject(error);
      });
  });
};


// Run spleeter using Docker
const runSpleeter = async (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
      const command = `docker run -v ${path.dirname(inputPath)}:/input -v ${path.dirname(outputPath)}:/output researchdeezer/spleeter separate -i /input/${path.basename(inputPath)} -o /output -p spleeter:2stems`;

      exec(command, (error, stdout, stderr) => {
          if (error) {
              console.error(`exec error: ${error}`);
              reject(error);
              return;
          }
          console.log(`stdout: ${stdout}`);
          console.error(`stderr: ${stderr}`);
          resolve();
      });
  });
};



export const processService = async (url, req) => {
    console.log(`Processing the URL: ${url}`);
    try {
        const audioPath = path.resolve(config.basePath, "downloads", "audio.mp3");
        const outputDir = path.resolve(config.basePath, "public", "output");

        if (!fs.existsSync(path.dirname(audioPath))) {
            fs.mkdirSync(path.dirname(audioPath), { recursive: true });
        }

        // console.log("Download started");
        // await downloadYouTubeAudio(url, audioPath);
        // console.log("Download finished");

        // Processing with Spleeter
        console.log("Processing started");
        await runSpleeter(audioPath, outputDir);
        console.log("Processing finished");

        const baseUrl = getFullUrl(req);
        return `${baseUrl}/public/output/instrumental.mp3`;
    } catch (error) {
        console.error("Failed to process URL:", error);
        throw error;
    }
};


