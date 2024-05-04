import ytdl from 'ytdl-core';
import { spawn } from 'child_process';
import stream from 'stream';

export const processYoutubeUrl = async (req, res) => {
  try {
    const url = req.query.url;
    if (!ytdl.validateURL(url)) {
      return res.status(400).send('Invalid URL');
    }

    const info = await ytdl.getBasicInfo(url);
    const title = info.videoDetails.title.replace(/[^\x00-\x7F]/g, "");
    const safeTitle = title.replace(/[^a-zA-Z0-9-_ ]/g, "_");

    res.header('Content-Disposition', `attachment; filename="${safeTitle}.mp3"`);
    res.header('Content-Type', 'audio/mpeg');

    const audioStream = ytdl(url, { filter: 'audioonly' });

    const ffmpegProcess = spawn('ffmpeg', [
      '-i', 'pipe:0',             
      '-codec:a', 'libmp3lame',   
      '-b:a', '192k',             
      '-f', 'mp3',                
      'pipe:1'  
    ]);

    audioStream.pipe(ffmpegProcess.stdin);
    if (ffmpegProcess.stdout instanceof stream.Readable) {
      ffmpegProcess.stdout.pipe(res);
    }

    ffmpegProcess.on('close', () => {
      console.log('Conversion and download finished.');
    });

    ffmpegProcess.stderr.on('data', (data) => {
      console.error(`ffmpeg stderr: ${data}`);
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Server error');
  }
};