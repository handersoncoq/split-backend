import ytdl from 'ytdl-core';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const processYoutubeUrl = async (req, res) => {
  const url = req.query.url;
  try {
    const info = await validateUrlAndGetInfo(url);
    const safeTitle = sanitizeTitle(info.videoDetails.title);
    const { outputPath, instrumentalPath } = getFilePaths(safeTitle);

    await convertToMp3(url, outputPath);
    await processWithSpleeter(outputPath, instrumentalPath, res);
    cleanupFiles(outputPath, instrumentalPath);
  } catch (error) {
    console.error('Error:', error.message);
    res.status(error.status || 500).send(error.message);
  }
};

const validateUrlAndGetInfo = async (url) => {
  if (!ytdl.validateURL(url)) {
    throw { status: 400, message: 'Invalid URL' };
  }
  return ytdl.getBasicInfo(url);
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
    const audioStream = ytdl(url, { filter: 'audioonly' });
    const ffmpegProcess = spawn('ffmpeg', ['-i', 'pipe:0', '-codec:a', 'libmp3lame', '-b:a', '192k', '-f', 'mp3', outputPath]);

    audioStream.pipe(ffmpegProcess.stdin);

    ffmpegProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('FFMPEG conversion failed'));
      } else {
        resolve();
      }
    });

    ffmpegProcess.on('error', reject);
  });
};

const processWithSpleeter = (outputPath, instrumentalPath, res) => {
    return new Promise((resolve, reject) => {
      const spleeterProcess = spawn('python3', ['-m', 'spleeter', 'separate', '-i', outputPath, '-p', 'spleeter:2stems', '-o', path.dirname(outputPath)]);
  
      spleeterProcess.stderr.on('data', (data) => {
        console.error(`Spleeter stderr: ${data.toString()}`);
      });
  
      spleeterProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Spleeter exited with code ${code}`));
        } else {
          res.sendFile(instrumentalPath, (err) => {
            if (err) {
              reject(new Error('Error sending file'));
            } else {
              resolve();
            }
          });
        }
      });
  
      spleeterProcess.on('error', (err) => {
        reject(new Error(`Spleeter process error: ${err}`));
      });
    });
  };
  

const cleanupFiles = (outputPath, instrumentalPath) => {
  fs.unlink(outputPath, (err) => { if (err) console.error('Error deleting original audio:', err); });
  fs.unlink(instrumentalPath, (err) => { if (err) console.error('Error deleting instrumental:', err); });
};
