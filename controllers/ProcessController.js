import ytdl from "ytdl-core";
import { spawn } from "child_process";
import stream from "stream";
import fetch from "node-fetch";

const API_KEY = "AIzaSyD3Q3IrRvajsrWOnrvPOY8cfYpAwHbf9Vc";

export const downloadYoutubeAudio = async (req, res) => {
  try {
    const url = req.query.url;
    if (!ytdl.validateURL(url)) {
      return res.status(400).send("Invalid URL");
    }

    const videoId = ytdl.getVideoID(url);
    const info = await getVideoInfo(videoId);
    const title = info.videoDetails.title.replace(/[^\x00-\x7F]/g, "");
    const safeTitle = title.replace(/[^a-zA-Z0-9-_ ]/g, "_");

    res.header(
      "Content-Disposition",
      `attachment; filename="${safeTitle}.mp3"`
    );
    res.header("Content-Type", "audio/mpeg");

    const audioStream = await getAudioStream(info);

    const ffmpegProcess = spawn("ffmpeg", [
      "-i",
      "pipe:0",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "192k",
      "-f",
      "mp3",
      "pipe:1",
    ]);

    audioStream.on("error", (error) => {
      console.error("ytdl-core stream error:", error);
      ffmpegProcess.kill();
      res.status(500).send("Stream error");
    });

    if (ffmpegProcess.stdout instanceof stream.Readable) {
      ffmpegProcess.stdout.pipe(res);
      ffmpegProcess.stdout.on("error", (error) => {
        console.error("FFMPEG stdout stream error:", error);
        res.status(500).send("Conversion error");
      });
    }

    ffmpegProcess.on("error", (error) => {
      console.error("FFMPEG process error:", error);
      res.status(500).send("FFMPEG error");
    });

    ffmpegProcess.on("close", (code) => {
      if (code !== 0) {
        console.log(`FFMPEG exited with code ${code}`);
      } else {
        console.log("Conversion and download finished.");
      }
    });

    ffmpegProcess.stderr.on("data", (data) => {
      console.error(`FFMPEG stderr: ${data}`);
    });

    audioStream.pipe(ffmpegProcess.stdin);

    req.on("close", () => {
      if (!res.finished) {
        ffmpegProcess.kill();
        audioStream.unpipe(ffmpegProcess.stdin);
      }
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Server error");
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

  const data = await response.json();
  if (!data.streamingData) {
    throw new Error("No streaming data available");
  }

  return data;
};

const getAudioStream = async (info) => {
  const audioFormat = info.streamingData.adaptiveFormats.find((f) =>
    f.mimeType.includes("audio/mp4")
  );
  if (!audioFormat) {
    throw new Error("No suitable audio format found");
  }

  const response = await fetch(audioFormat.url);
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.statusText}`);
  }

  return response.body;
};
