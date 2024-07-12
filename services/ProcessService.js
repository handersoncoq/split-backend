import ytdl from "ytdl-core";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import fetch from "node-fetch";

const API_KEY = "AIzaSyD3Q3IrRvajsrWOnrvPOY8cfYpAwHbf9Vc";

export const processYoutubeUrl = async (req, res) => {
  const url = req.query.url;
  const videoId = ytdl.getVideoID(url);

  try {
    const info = await getVideoInfo(videoId);
    const safeTitle = sanitizeTitle(info.videoDetails.title);
    const { outputPath, instrumentalPath } = getFilePaths(safeTitle);

    await convertToMp3(url, outputPath);
    await processWithSpleeter(outputPath, instrumentalPath, res);
    cleanupFiles(outputPath, instrumentalPath);
  } catch (error) {
    console.error("Error:", error);
    res.status(error.status || 500).send(error);
  }
};

const getVideoInfo = async (videoId) => {
  const headers = {
    "X-YouTube-Client-Name": "5",
    "X-YouTube-Client-Version": "19.09.3",
    Origin: "https://www.youtube.com",
    "User-Agent":
      "com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)",
    "content-type": "application/json",
  };

  const body = {
    context: {
      client: {
        clientName: "IOS",
        clientVersion: "19.09.3",
        deviceModel: "iPhone14,3",
        userAgent:
          "com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)",
        hl: "en",
        timeZone: "UTC",
        utcOffsetMinutes: 0,
      },
    },
    videoId,
    playbackContext: {
      contentPlaybackContext: { html5Preference: "HTML5_PREF_WANTS" },
    },
    contentCheckOk: true,
    racyCheckOk: true,
  };

  const response = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${API_KEY}&prettyPrint=false`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch video info: ${response.statusText}`);
  }

  return response.json();
};

const sanitizeTitle = (title) => {
  title = title.replace(/[^\x00-\x7F]/g, "");
  return title.replace(/[^a-zA-Z0-9-_ ]/g, "_");
};

const getFilePaths = (safeTitle) => {
  const tempDir = os.tmpdir();
  const outputPath = path.join(tempDir, `${safeTitle}.mp3`);
  const instrumentalPath = path.join(tempDir, `${safeTitle}_instrumental.mp3`);
  return { outputPath, instrumentalPath };
};

const convertToMp3 = (url, outputPath) => {
  return new Promise((resolve, reject) => {
    const audioStream = ytdl(url, {
      filter: "audioonly",
      requestOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
        },
      },
    });

    const ffmpegProcess = spawn("ffmpeg", [
      "-i",
      "pipe:0",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "192k",
      "-f",
      "mp3",
      outputPath,
    ]);

    audioStream.pipe(ffmpegProcess.stdin);

    ffmpegProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("FFMPEG conversion failed"));
      } else {
        resolve();
      }
    });

    ffmpegProcess.on("error", reject);
  });
};

const processWithSpleeter = (outputPath, instrumentalPath, res) => {
  return new Promise((resolve, reject) => {
    const spleeterProcess = spawn("python3", [
      "-m",
      "spleeter",
      "separate",
      "-i",
      outputPath,
      "-p",
      "spleeter:2stems",
      "-o",
      path.dirname(outputPath),
    ]);

    spleeterProcess.stderr.on("data", (data) => {
      console.error(`Spleeter stderr: ${data.toString()}`);
    });

    spleeterProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Spleeter exited with code ${code}`));
      } else {
        res.sendFile(instrumentalPath, (err) => {
          if (err) {
            reject(new Error("Error sending file"));
          } else {
            resolve();
          }
        });
      }
    });

    spleeterProcess.on("error", (err) => {
      reject(new Error(`Spleeter process error: ${err}`));
    });
  });
};

const cleanupFiles = (outputPath, instrumentalPath) => {
  fs.unlink(outputPath, (err) => {
    if (err) console.error("Error deleting original audio:", err);
  });
  fs.unlink(instrumentalPath, (err) => {
    if (err) console.error("Error deleting instrumental:", err);
  });
};
